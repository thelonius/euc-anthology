import { h } from 'preact'
import { lazy } from 'preact/compat'
import { LocalizedChapter } from '../components/LocalizedChapter'

const Ru = lazy(() => import('./BalanceChapter.ru'))
const En = lazy(() => import('./BalanceChapter.en'))

export default function BalanceChapter() {
  return <LocalizedChapter id="balance" ru={Ru} en={En}/>
}
