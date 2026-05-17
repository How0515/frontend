import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendApi } from "../../lib/backend";

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const summaryCount = dashboard ? Object.keys(dashboard).length : "-";

  useEffect(() => {
    backendApi.getAdminDashboard().then((data) => setDashboard(data));
  }, []);

  return (
    <section className="panel">
      <p className="eyebrow">관리자 홈</p>
      <h2>관리자 대시보드</h2>
      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">총 이벤트</span>
          <strong>{summaryCount}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">승인 대기</span>
          <strong>12</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">분쟁 처리</span>
          <strong>4</strong>
        </article>
      </div>

      <div className="action-row">
        <Link className="button primary" to="/admin/organizer-approvals">
          주최자 승인
        </Link>
        <Link className="button" to="/admin/events">
          이벤트 감독
        </Link>
        <Link className="button" to="/admin/users">
          사용자 관리
        </Link>
        <Link className="button" to="/admin/disputes">
          분쟁/거래 센터
        </Link>
      </div>

      <section className="table-shell">
        <header className="table-head">
          <h3>최근 요약</h3>
          <span className="badge neutral">LIVE</span>
        </header>
        <pre className="code">{JSON.stringify(dashboard, null, 2)}</pre>
      </section>
    </section>
  );
}
