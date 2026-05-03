import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./ThermalChapter.ru'))
const En = lazy(() => import('./ThermalChapter.en'))

export default function ThermalChapter() {
  return <LocalizedChapter id="thermal" ru={Ru} en={En}/>
}
