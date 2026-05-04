import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./IMUChapter.ru'))
const En = lazy(() => import('./IMUChapter.en'))

export default function IMUChapter() {
  return <LocalizedChapter id="imu" ru={Ru} en={En}/>
}
