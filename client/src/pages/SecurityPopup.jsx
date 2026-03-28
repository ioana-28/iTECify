import '../style/SecurityPopup.css'

export function SecurityPopup({ open, message, attackType, onClose }) {
  if (!open) {
    return null
  }

  return (
    <div className="security-popup-overlay" role="dialog" aria-modal="true" aria-label="Security alert">
      <div className="security-popup-panel">
        <div className="security-popup-glitch" aria-hidden="true">⚠ SYSTEM ALERT ⚠</div>
        <div className="security-popup-icon" aria-hidden="true">💅🏾</div>
        <h2 className="security-popup-title">Hacker Diva Detected</h2>
        {attackType ? (
          <div className="security-popup-type">Attack type: {attackType}</div>
        ) : null}
        <p className="security-popup-message">{message}</p>
        <button className="security-popup-close-btn" onClick={onClose}>
          I&apos;m sorry, Queen
        </button>
      </div>
    </div>
  )
}

export default SecurityPopup
