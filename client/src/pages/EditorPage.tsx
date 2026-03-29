/* Re-export EditorPage from JSX component */
// @ts-expect-error JSX file imports
import { EditorScreen } from './EditorScreen.jsx'

export function EditorPage() {
  return <EditorScreen />
}
