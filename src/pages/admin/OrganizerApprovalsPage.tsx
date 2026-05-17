import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";

type ApplicationItem = {
  id?: string;
  userId?: string;
  status?: string;
  [key: string]: unknown;
};

export function OrganizerApprovalsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);

  async function load() {
    const data = await backendApi.getOrganizerApplications();
    setItems(data.items as ApplicationItem[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    await backendApi.reviewOrganizerApplication(id, decision);
    await load();
  }

  return (
    <section className="panel">
      <p className="eyebrow">주최자 관리</p>
      <h2>주최자 승인</h2>
      <div className="table-shell">
        <header className="table-head">
          <h3>승인 대기 목록</h3>
          <span className="badge warning">{items.length}건</span>
        </header>
        <div className="table-list">
        {items.map((item) => (
          <article className="table-row" key={item.id ?? JSON.stringify(item)}>
            <div>
              <strong>{String(item.userId ?? item.id ?? "unknown")}</strong>
              <p className="table-subtext">{String(item.status ?? "PENDING")}</p>
            </div>
            <pre className="code">{JSON.stringify(item, null, 2)}</pre>
            {item.id ? (
              <div className="action-row align-right">
                <button className="button primary" onClick={() => void review(item.id as string, "APPROVED")}>
                  승인
                </button>
                <button className="button" onClick={() => void review(item.id as string, "REJECTED")}>
                  거절
                </button>
              </div>
            ) : null}
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}
