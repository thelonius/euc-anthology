import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./HackChapter.ru'))
const En = lazy(() => import('./HackChapter.en'))

export default function HackChapter() {
  return <LocalizedChapter id="hack" ru={Ru} en={En}/>
}
