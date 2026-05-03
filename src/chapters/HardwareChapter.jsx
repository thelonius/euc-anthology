import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./HardwareChapter.ru'))
const En = lazy(() => import('./HardwareChapter.en'))

export default function HardwareChapter() {
  return <LocalizedChapter id="hardware" ru={Ru} en={En}/>
}
