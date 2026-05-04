import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./Prologue.ru'))
const En = lazy(() => import('./Prologue.en'))

export default function Prologue() {
  return <LocalizedChapter id="prologue" ru={Ru} en={En}/>
}
