import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./RAMMapChapter.ru'))
const En = lazy(() => import('./RAMMapChapter.en'))

export default function RAMMapChapter() {
  return <LocalizedChapter id="ram" ru={Ru} en={En}/>
}
