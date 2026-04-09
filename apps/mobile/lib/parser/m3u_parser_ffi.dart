import 'dart:convert';
import 'dart:ffi';
import 'dart:isolate';
import 'dart:typed_data';
import 'package:ffi/ffi.dart';

import '../models/index.dart';

// ---------------------------------------------------------------------------
// Native function signatures
// ---------------------------------------------------------------------------

typedef _ParseM3UFfiNative = Pointer<Uint8> Function(
  Pointer<Uint8> contentPtr,
  Size contentLen,
  Pointer<Size> outLen,
);

typedef _ParseM3UFfi = Pointer<Uint8> Function(
  Pointer<Uint8> contentPtr,
  int contentLen,
  Pointer<Size> outLen,
);

typedef _FreeParseResultNative = Void Function(Pointer<Uint8> ptr, Size len);
typedef _FreeParseResult = void Function(Pointer<Uint8> ptr, int len);

// ---------------------------------------------------------------------------
// Library loader (singleton)
// ---------------------------------------------------------------------------

DynamicLibrary? _lib;

DynamicLibrary _loadLib() {
  _lib ??= DynamicLibrary.open('libzenith_parser.so');
  return _lib!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Parses M3U content on a background isolate and returns [M3UObject] list.
/// Throws if the native library fails to load or parse.
Future<List<M3UObject>> parseM3UAsync(String content) {
  return Isolate.run(() => _parseM3USync(content));
}

// ---------------------------------------------------------------------------
// Internal — runs inside isolate
// ---------------------------------------------------------------------------

List<M3UObject> _parseM3USync(String content) {
  final lib = _loadLib();

  final parseFn = lib.lookupFunction<_ParseM3UFfiNative, _ParseM3UFfi>(
    'parse_m3u_ffi',
  );
  final freeFn = lib.lookupFunction<_FreeParseResultNative, _FreeParseResult>(
    'free_parse_result',
  );

  // Encode content to UTF-8 bytes
  final encoded = _toUtf8Bytes(content);
  final contentLen = encoded.length;

  // Allocate input + outLen pointer on native heap
  final contentPtr = calloc<Uint8>(contentLen);
  final outLenPtr = calloc<Size>();

  try {
    final nativeBytes = contentPtr.asTypedList(contentLen);
    nativeBytes.setAll(0, encoded);

    final bufPtr = parseFn(contentPtr, contentLen, outLenPtr);

    if (bufPtr.address == 0) {
      throw Exception('[M3UParser] parse_m3u_ffi returned null');
    }

    final bufLen = outLenPtr.value;

    try {
      return _readFlatBuffer(bufPtr, bufLen);
    } finally {
      freeFn(bufPtr, bufLen);
    }
  } finally {
    calloc.free(contentPtr);
    calloc.free(outLenPtr);
  }
}

// ---------------------------------------------------------------------------
// Flat buffer reader
//
// Layout (written by Rust build_flat_buffer):
//   [string_pool: u8...]
//   [items: FfiItem * count]   — each FfiItem = 8 × u32 (32 bytes)
//   [count: u32]               — last 4 bytes
//
// FfiItem fields (u32 each):
//   0: title_off
//   1: url_off
//   2: group_off
//   3: logo_off   (u32::MAX = None)
//   4: category   (0=LiveStream, 1=Series, 2=Movie)
//   5: year       (0 = None)
//   6: season     (0 = None)
//   7: episode    (0 = None)
// ---------------------------------------------------------------------------

const int _kItemFields = 8;
const int _kItemBytes = _kItemFields * 4; // 32 bytes per item
const int _kLogoNone = 0xFFFFFFFF;

List<M3UObject> _readFlatBuffer(Pointer<Uint8> ptr, int bufLen) {
  // Copy buffer to Dart-managed Uint8List for safe access
  final buf = Uint8List.fromList(ptr.asTypedList(bufLen));
  final bd = buf.buffer.asByteData();

  // Read item count from last 4 bytes
  final count = bd.getUint32(bufLen - 4, Endian.little);

  if (count == 0) return const [];

  // Item block starts at: bufLen - 4 - (count * _kItemBytes)
  final itemBlockStart = bufLen - 4 - count * _kItemBytes;
  // String pool ends at itemBlockStart
  final poolEnd = itemBlockStart;

  final items = <M3UObject>[];

  for (var i = 0; i < count; i++) {
    final base = itemBlockStart + i * _kItemBytes;

    final titleOff   = bd.getUint32(base + 0,  Endian.little);
    final urlOff     = bd.getUint32(base + 4,  Endian.little);
    final groupOff   = bd.getUint32(base + 8,  Endian.little);
    final logoOff    = bd.getUint32(base + 12, Endian.little);
    final categoryId = bd.getUint32(base + 16, Endian.little);
    final year       = bd.getUint32(base + 20, Endian.little);
    final season     = bd.getUint32(base + 24, Endian.little);
    final episode    = bd.getUint32(base + 28, Endian.little);

    items.add(M3UObject(
      title:    _readCStr(buf, titleOff, poolEnd),
      url:      _readCStr(buf, urlOff,   poolEnd),
      group:    _readCStr(buf, groupOff, poolEnd),
      logo:     logoOff == _kLogoNone ? null : _readCStr(buf, logoOff, poolEnd),
      category: _categoryFromId(categoryId),
      year:     year   == 0 ? null : year,
      season:   season == 0 ? null : season,
      episode:  episode == 0 ? null : episode,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Reads a null-terminated UTF-8 string from [buf] starting at [offset].
String _readCStr(Uint8List buf, int offset, int maxOffset) {
  var end = offset;
  while (end < maxOffset && buf[end] != 0) {
    end++;
  }
  return utf8.decode(buf.sublist(offset, end), allowMalformed: true);
}

M3UCategory _categoryFromId(int id) {
  switch (id) {
    case 1:  return M3UCategory.series;
    case 2:  return M3UCategory.movie;
    default: return M3UCategory.liveStream;
  }
}

Uint8List _toUtf8Bytes(String s) => utf8.encode(s);
