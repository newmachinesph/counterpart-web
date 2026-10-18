import styles from "./pairing-journey.module.css";

const stages = [
  {
    name: "Proving run", label: "Start with proof", tone: "proving",
    description: "Accept a saved commercial offer before starting. The agreed fee and commission apply during the trial.",
    outcome: "Paid work, no automatic equity", next: "Both parties agree to continue",
    exit: { name: "Ended", trigger: "Trial ends without continuation", description: "Future work stops. Accrued compensation and the agreed pipeline tail remain payable." },
  },
  {
    name: "Active", label: "Build momentum", tone: "active",
    description: "Continue under the saved cash terms. Performance goals show progress without granting shares.",
    outcome: "Results and payment evidence", next: "Separate cofounder decision",
    exit: { name: "Released", trigger: "Engagement ends", description: "Accrued compensation survives. Any existing equity follows its signed instrument." },
  },
  {
    name: "Cofounder", label: "Agree ownership separately", tone: "completed",
    description: "A signed instrument, company approvals, units, vesting and departure terms define the grant. Both parties accept the record.",
    outcome: "Ownership follows the instrument", next: null, exit: null,
  },
] as const;

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PairingJourney() {
  return (
    <section id="pairing-journey" className={styles.section} aria-labelledby="pairing-journey-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}><span /> The life of a pairing</p>
            <h2 id="pairing-journey-title" className={styles.title}>A clear path.<br /><em>At every stage.</em></h2>
          </div>
          <p className={styles.intro}>Start by proving the fit. Grow through milestones. Wherever the partnership goes, you always know where you stand.</p>
        </div>

        <ol className={styles.journey}>
          {stages.map((stage, index) => (
            <li key={stage.name} className={styles.stage} data-tone={stage.tone}>
              <div className={styles.main}>
                <div className={styles.marker} aria-hidden="true">
                  {index === 2 ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span>{index + 1}</span>}
                </div>
                <p className={styles.stageLabel}>{stage.label}</p>
                <h3 className={styles.stageTitle}>{stage.name}</h3>
                <p className={styles.description}>{stage.description}</p>
                <p className={styles.outcome}><span />{stage.outcome}</p>
              </div>
              {stage.exit && (
                <aside className={styles.exit} aria-label={`Alternative outcome from ${stage.name}`}>
                  <p className={styles.trigger}>{stage.exit.trigger}</p>
                  <div className={styles.exitCard}>
                    <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4v9a3 3 0 0 0 3 3h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{stage.exit.name}</h4>
                    <p>{stage.exit.description}</p>
                  </div>
                </aside>
              )}
              {stage.next && <div className={styles.connector}><span>{stage.next}</span><Arrow /></div>}
            </li>
          ))}
        </ol>

        <div className={styles.principle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p><strong>Vested equity stays vested.</strong><span>Ending a pairing only affects what hasn’t been earned yet.</span></p>
        </div>
      </div>
    </section>
  );
}
