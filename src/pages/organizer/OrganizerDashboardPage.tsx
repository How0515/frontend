import { Link } from "react-router-dom";

export function OrganizerDashboardPage() {
  return (
    <section className="panel">
      <h2>주최자 대시보드</h2>
      <p>이벤트 등록, 티켓 발행, 체크인 관리를 한 곳에서 수행합니다.</p>
      <div className="action-row">
        <Link className="button primary" to="/organizer/events/new">
          이벤트 등록
        </Link>
        <Link className="button" to="/organizer/events">
          내 이벤트
        </Link>
        <Link className="button" to="/organizer/me">
          내 정보
        </Link>
        <Link className="button" to="/organizer/start">
          시작 화면
        </Link>
      </div>
    </section>
  );
}
