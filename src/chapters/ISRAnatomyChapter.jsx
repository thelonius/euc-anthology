import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./ISRAnatomyChapter.ru'))
const En = lazy(() => import('./ISRAnatomyChapter.en'))

export default function ISRAnatomyChapter() {
  return <LocalizedChapter id="isr" ru={Ru} en={En}/>
}
