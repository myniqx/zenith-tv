export class exString {
  private static charMap: { [key: string]: string } = {
    'ş': 's',
    'ç': 'c',
    'ı': 'i',
    'ğ': 'g',
    'ü': 'u',
    'ö': 'o'
  };

  public static hasMatch(param: string[], name: string): boolean {
    const charMatch = (a: string, b: string): boolean => {
      a = exString.charMap[a] || a;
      b = exString.charMap[b] || b;
      return a === b;
    };

    let start = 0;
    let end = name.length - param.reduce((sum, p) => sum + p.length, 0);

    for (const txt of param) {
      let paramLen = txt.length;
      let paramFound = false;

      for (let i = start; i < end; i++) {
        let found = true;

        for (let j = 0; j < paramLen; j++) {
          const cA = name[i + j].toLowerCase();
          const cB = txt[j];

          if (!charMatch(cA, cB)) {
            found = false;
            break;
          }
        }

        if (found) {
          start = i + paramLen;
          paramFound = true;
        }
      }

      if (!paramFound) {
        return false;
      }
    }

    return true;
  }
}
