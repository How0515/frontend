import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { ResaleListing } from "../../types/api";

function listingIdOf(listing: ResaleListing) {
  return String((listing as ResaleListing & { id?: string }).id ?? listing.listingId);
}

function listingPriceOf(listing: ResaleListing) {
  return String((listing as ResaleListing & { priceWei?: string }).priceWei ?? listing.price ?? "-");
}

export function ResaleDetailPage() {
  const { listingId = "" } = useParams();
  const [item, setItem] = useState<ResaleListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!listingId) {
      return;
    }

    setLoading(true);
    backendApi
      .getResaleListing(listingId)
      .then((result) => setItem(result))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "리셀 상세 정보를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [listingId]);

  async function onPurchase() {
    if (!item) {
      setMessage("리셀 상세 정보를 먼저 불러와야 구매할 수 있습니다.");
      return;
    }

    await backendApi.purchaseResale(listingIdOf(item));
    setMessage("리셀 티켓 구매가 완료되었습니다.");
  }

  return (
    <section className="panel">
      <h2>리셀 상세</h2>
      {loading ? <p className="lead">리셀 상세 정보를 불러오는 중입니다.</p> : null}
      {item ? (
        <div className="event-card">
          <h3>{item.eventName || `이벤트 ${String(item.eventId).slice(0, 8)}`}</h3>
          <p>좌석: {item.seatInfo || `티켓 ${String(item.ticketId).slice(0, 8)}`}</p>
          <p>가격: {listingPriceOf(item)} WEI</p>
          <p>상태: {item.status}</p>
          <p>판매자: {item.sellerDisplayName || (item as ResaleListing & { sellerId?: string }).sellerId || "-"}</p>
        </div>
      ) : null}
      <button className="button primary" disabled={!item || item.status !== "ACTIVE"} onClick={() => void onPurchase()}>
        리셀 티켓 구매
      </button>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
