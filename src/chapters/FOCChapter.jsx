import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./FOCChapter.ru'))
const En = lazy(() => import('./FOCChapter.en'))

export default function FOCChapter() {
  return <LocalizedChapter id="foc" ru={Ru} en={En}/>
}
