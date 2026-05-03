import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./FieldWeakeningChapter.ru'))
const En = lazy(() => import('./FieldWeakeningChapter.en'))

export default function FieldWeakeningChapter() {
  return <LocalizedChapter id="fw" ru={Ru} en={En}/>
}
