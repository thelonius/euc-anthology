import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./CalibrationChapter.ru'))
const En = lazy(() => import('./CalibrationChapter.en'))

export default function CalibrationChapter() {
  return <LocalizedChapter id="boot" ru={Ru} en={En}/>
}
