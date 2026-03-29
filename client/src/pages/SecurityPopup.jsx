import '../style/SecurityPopup.css'

export function SecurityPopup({ isOpen, message, onClose }) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="security-popup-overlay" role="dialog" aria-modal="true" aria-label="Security alert">
      <div className="security-popup-card">
        <div className="security-popup-glitch" aria-hidden="true" />
        <div className="security-popup-icon" aria-hidden="true">
          💅🏾
        </div>
        <h2 className="security-popup-title">Hacker Diva Alert</h2>
        <p className="security-popup-message">{message}</p>
        <button type="button" className="security-popup-close" onClick={onClose}>
          I'm sorry, Queen
        </button>
      </div>
    </div>
  )
}
