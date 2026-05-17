import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backend";

export function DisputesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    backendApi.getDisputes().then((data) => setItems(data.items));
  }, []);

  return (
    <section className="panel">
      <p className="eyebrow">거래 모니터링</p>
      <h2>분쟁 / 거래 센터</h2>
      <div className="table-shell">
        <header className="table-head">
          <h3>최근 거래 및 분쟁</h3>
          <span className="badge neutral">{items.length}건</span>
        </header>
        <div className="table-list">
        {items.map((item, idx) => (
          <article key={idx} className="table-row">
            <div>
              <strong>{String(item.type ?? item.category ?? `record-${idx + 1}`)}</strong>
              <p className="table-subtext">{String(item.status ?? item.txStatus ?? "OPEN")}</p>
            </div>
            <pre className="code">{JSON.stringify(item, null, 2)}</pre>
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}
