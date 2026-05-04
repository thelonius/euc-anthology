import { h, Fragment } from 'preact'
import { Suspense } from 'preact/compat'
import { useLang } from '../i18n'
import { TRANSLATED_TO_EN } from '../i18n/chapters'
import { TranslationPending } from './TranslationPending'
import { ChapterSkeleton } from './ChapterSkeleton'

// Picks the right localized variant of a chapter, lazy-loads it,
// and shows a "translation in progress" badge when EN is requested
// but the .en.jsx file is still a re-export of the .ru.jsx.
export function LocalizedChapter({ id, ru: Ru, en: En }) {
  const lang = useLang()
  const hasEn = TRANSLATED_TO_EN.has(id)
  const showPending = lang === 'en' && !hasEn
  const Component = lang === 'en' && hasEn ? En : Ru
  return (
    <Suspense fallback={<ChapterSkeleton/>}>
      <Fragment>
        {showPending && <TranslationPending/>}
        <Component/>
      </Fragment>
    </Suspense>
  )
}
