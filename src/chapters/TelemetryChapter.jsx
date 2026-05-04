import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./TelemetryChapter.ru'))
const En = lazy(() => import('./TelemetryChapter.en'))

export default function TelemetryChapter() {
  return <LocalizedChapter id="telemetry" ru={Ru} en={En}/>
}
