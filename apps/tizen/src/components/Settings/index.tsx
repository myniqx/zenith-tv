import { useSettingsStore } from '../../stores/settings'
import { FocusButton } from '../Navigation'
import { FocusScope } from '../../contexts/FocusScope'
import { Separator } from '@zenith-tv/ui/separator'

interface ToggleRowProps {
  focusId: string
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ focusId, label, description, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <p className="text-base font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <FocusButton
        focusId={focusId}
        onClick={() => onChange(!value)}
        variant={value ? 'default' : 'secondary'}
        className="min-w-[80px]"
      >
        {value ? 'Açık' : 'Kapalı'}
      </FocusButton>
    </div>
  )
}

interface LanguageRowProps {
  focusIdClear: string
  label: string
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}

function LanguageRow({ focusIdClear, label, value, options, onChange }: LanguageRowProps) {
  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-base font-medium text-foreground">{label}</p>
        {value && (
          <FocusButton
            focusId={focusIdClear}
            onClick={() => onChange(null)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            Temizle
          </FocusButton>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {options.map((lang) => (
          <FocusButton
            key={lang}
            focusId={`${focusIdClear}-${lang}`}
            onClick={() => onChange(lang)}
            variant={value === lang ? 'default' : 'secondary'}
            size="sm"
          >
            {lang.toUpperCase()}
          </FocusButton>
        ))}
      </div>
    </div>
  )
}

const AUDIO_LANGUAGES = ['tur', 'eng', 'deu', 'fra', 'spa', 'ara']
const SUBTITLE_LANGUAGES = ['tur', 'eng', 'deu', 'fra', 'spa', 'ara', 'off']

export function Settings() {
  const {
    autoResume,
    autoPlayNext,
    preferredAudioLanguage,
    preferredSubtitleLanguage,
    setAutoResume,
    setAutoPlayNext,
    setPreferredAudioLanguage,
    setPreferredSubtitleLanguage,
  } = useSettingsStore()

  return (
    <div className="h-full bg-background text-foreground overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-8">Ayarlar</h1>

        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Oynatma</h2>
          <FocusScope id="settings-playback">
            <Separator className="mb-2" />
            <ToggleRow
              focusId="settings-auto-resume"
              label="Kaldığım Yerden Devam Et"
              description="Videoyu son bıraktığın konumdan başlatır"
              value={autoResume}
              onChange={setAutoResume}
            />
            <Separator />
            <ToggleRow
              focusId="settings-auto-next"
              label="Sonraki Bölüme Geç"
              description="Dizi biterken otomatik sonraki bölümü başlatır"
              value={autoPlayNext}
              onChange={setAutoPlayNext}
            />
            <Separator />
          </FocusScope>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dil Tercihleri</h2>
          <FocusScope id="settings-language">
            <Separator className="mb-2" />
            <LanguageRow
              focusIdClear="settings-audio-lang-clear"
              label="Tercih Edilen Ses Dili"
              value={preferredAudioLanguage}
              options={AUDIO_LANGUAGES}
              onChange={setPreferredAudioLanguage}
            />
            <Separator />
            <LanguageRow
              focusIdClear="settings-sub-lang-clear"
              label="Tercih Edilen Altyazı Dili"
              value={preferredSubtitleLanguage}
              options={SUBTITLE_LANGUAGES}
              onChange={setPreferredSubtitleLanguage}
            />
            <Separator />
          </FocusScope>
        </section>
      </div>
    </div>
  )
}
