import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./HFIChapter.ru'))
const En = lazy(() => import('./HFIChapter.en'))

export default function HFIChapter() {
  return <LocalizedChapter id="hfi" ru={Ru} en={En}/>
}
