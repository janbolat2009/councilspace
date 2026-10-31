import { ArrowUpRight, Download, FileText } from "lucide-react";
import styles from "./academic-year-plan.module.css";

export function AcademicYearPlan() {
  return (
    <section className={styles.plan} aria-labelledby="academic-year-plan-title">
      <div className={styles.intro}>
        <span className={styles.kicker}>INTELLECTUAL DEVELOPMENT · ДОКУМЕНТЫ</span>
        <h2 id="academic-year-plan-title">План на учебный год</h2>
        <span className={styles.year}>2026–2027</span>
        <p>Встречи, проекты и главные события года — наш общий ориентир для работы команды.</p>
        <a
          className="button button-primary"
          href="https://docs.google.com/document/d/15ts-g6lG48p0rf5h1RslsJHi8D-G8ytNyxcA6AuNdRY/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть в Google Docs <ArrowUpRight size={17} aria-hidden="true" />
          <span className={styles.srOnly}> (в новой вкладке)</span>
        </a>
        <small className={styles.onlineNote}>Актуальная версия плана — в Google Docs</small>
      </div>
      <div className={styles.file}>
        <span className={styles.fileIcon}><FileText size={28} strokeWidth={1.5} aria-hidden="true" /></span>
        <div className={styles.fileDetails}>
          <span className={styles.fileType}>PDF · 174 КБ</span>
          <h3>План работы департамента</h3>
          <p>2026–2027 учебный год</p>
        </div>
        <a
          className="button button-outline"
          href="/documents/intellectual-development-plan-2026-2027.pdf"
          download="Intellectual-Development-Plan-2026-2027.pdf"
        >
          <Download size={17} aria-hidden="true" /> Скачать PDF
        </a>
        <small className={styles.fileNote}>Копия от 31 октября 2026 · для чтения без интернета</small>
      </div>
    </section>
  );
}
