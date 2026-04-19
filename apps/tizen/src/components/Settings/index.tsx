import { useSettingsStore } from '../../stores/settings'
import { Button, HorizontalList, VerticalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import { Check } from 'lucide-react'

interface ToggleRowProps {
  fKey: string
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ fKey, label, description, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-5">
      <div>
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button
        fKey={fKey}
        onClick={() => onChange(!value)}
        className="cursor-pointer"
      >
        {({ focused }) => (
          <div className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-200',
            value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground',
            focused && !value && 'bg-accent text-foreground',
            focused && 'ring-2 ring-primary/50',
          )}>
            {value && <Check className="w-3.5 h-3.5" />}
            {value ? 'Açık' : 'Kapalı'}
          </div>
        )}
      </Button>
    </div>
  )
}

interface LanguageRowProps {
  fKeyPrefix: string
  label: string
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}

function LanguageRow({ fKeyPrefix, label, value, options, onChange }: LanguageRowProps) {
  return (
    <div className="py-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-base font-semibold text-foreground">{label}</p>
        {value && (
          <Button
            fKey={`${fKeyPrefix}-clear`}
            onClick={() => onChange(null)}
            className="cursor-pointer"
          >
            {({ focused }) => (
              <span className={cn(
                'text-xs font-bold uppercase tracking-widest transition-colors duration-200 px-3 py-1.5 rounded-full',
                focused ? 'text-foreground bg-accent' : 'text-muted-foreground',
              )}>
                Temizle
              </span>
            )}
          </Button>
        )}
      </div>
      <HorizontalList fKey={`${fKeyPrefix}-langs`}>
        <div className="flex gap-2 flex-wrap">
          {options.map((lang) => {
            const isActive = value === lang
            return (
              <Button
                key={lang}
                fKey={`${fKeyPrefix}-${lang}`}
                onClick={() => onChange(lang)}
                className="cursor-pointer"
              >
                {({ focused }) => (
                  <span className={cn(
                    'inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground',
                    focused && !isActive && 'bg-accent text-foreground',
                    focused && 'ring-2 ring-primary/50',
                  )}>
                    {lang.toUpperCase()}
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      </HorizontalList>
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
    <div className="flex-1 min-h-0 bg-background text-foreground overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-1">Ayarlar</h1>
        <p className="text-sm text-muted-foreground mb-10">Uygulama tercihlerinizi yönetin</p>

        <VerticalList fKey="settings">
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Oynatma
            </h2>
            <div className="bg-secondary rounded-xl overflow-hidden">
              <div className="px-6">
                <ToggleRow
                  fKey="settings-auto-resume"
                  label="Kaldığım Yerden Devam Et"
                  description="Videoyu son bıraktığın konumdan başlatır"
                  value={autoResume}
                  onChange={setAutoResume}
                />
                <div className="h-px bg-border/20" />
                <ToggleRow
                  fKey="settings-auto-next"
                  label="Sonraki Bölüme Geç"
                  description="Dizi biterken otomatik sonraki bölümü başlatır"
                  value={autoPlayNext}
                  onChange={setAutoPlayNext}
                />
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Dil Tercihleri
            </h2>
            <div className="bg-secondary rounded-xl overflow-hidden">
              <div className="px-6">
                <LanguageRow
                  fKeyPrefix="settings-audio-lang"
                  label="Tercih Edilen Ses Dili"
                  value={preferredAudioLanguage}
                  options={AUDIO_LANGUAGES}
                  onChange={setPreferredAudioLanguage}
                />
                <div className="h-px bg-border/20" />
                <LanguageRow
                  fKeyPrefix="settings-sub-lang"
                  label="Tercih Edilen Altyazı Dili"
                  value={preferredSubtitleLanguage}
                  options={SUBTITLE_LANGUAGES}
                  onChange={setPreferredSubtitleLanguage}
                />
              </div>
            </div>
          </section>
        </VerticalList>
      </div>
    </div>
  )
}
