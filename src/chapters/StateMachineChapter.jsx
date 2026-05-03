import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./StateMachineChapter.ru'))
const En = lazy(() => import('./StateMachineChapter.en'))

export default function StateMachineChapter() {
  return <LocalizedChapter id="state" ru={Ru} en={En}/>
}
