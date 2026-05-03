import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./FluxObserverChapter.ru'))
const En = lazy(() => import('./FluxObserverChapter.en'))

export default function FluxObserverChapter() {
  return <LocalizedChapter id="observer" ru={Ru} en={En}/>
}
