import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { backendApi } from "../../lib/backend";
import type { EventDetail, TicketDetail } from "../../types/api";

function ticketIdOf(ticket: TicketDetail) {
  return String((ticket as TicketDetail & { id?: string }).id ?? ticket.ticketId);
}

function ticketPriceOf(ticket: TicketDetail, event: EventDetail | null) {
  return String(
    (ticket as TicketDetail & { originalPriceWei?: string; priceWei?: string }).originalPriceWei ??
      (ticket as TicketDetail & { priceWei?: string }).priceWei ??
      (event as EventDetail & { ticketPriceWei?: string } | null)?.ticketPriceWei ??
      "-",
  );
}

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!eventId) {
      return;
    }

    setLoading(true);
    Promise.all([backendApi.getEvent(eventId), backendApi.getEventTickets(eventId)])
      .then(([eventResult, ticketResult]) => {
        setEvent(eventResult);
        setTickets(ticketResult);
        const firstAvailable = ticketResult.find((ticket) => String(ticket.status) === "AVAILABLE");
        setSelectedTicketId(firstAvailable ? ticketIdOf(firstAvailable) : "");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "이벤트 정보를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => String(ticket.status) === "AVAILABLE"),
    [tickets],
  );

  async function onPrimaryPurchase() {
    if (!selectedTicketId) {
      setMessage("구매할 수 있는 티켓을 선택하세요.");
      return;
    }

    await backendApi.purchasePrimary(selectedTicketId);
    setMessage("1차 티켓 구매가 완료되었습니다.");
  }

  return (
    <section className="panel">
      <h2>이벤트 상세</h2>
      {loading ? <p className="lead">이벤트와 티켓 정보를 불러오는 중입니다.</p> : null}
      {event ? (
        <div className="event-card">
          <h3>{event.name || event.title}</h3>
          <p>{event.venue}</p>
          <p>{event.eventDateTime ? new Date(event.eventDateTime).toLocaleString() : "-"}</p>
          <p>{event.description}</p>
        </div>
      ) : null}

      <h3>1차 판매 티켓</h3>
      {availableTickets.length ? (
        <div className="table-shell">
          <div className="table-list">
            {availableTickets.map((ticket) => {
              const id = ticketIdOf(ticket);
              return (
                <label className="table-row" key={id}>
                  <input
                    type="radio"
                    name="ticket"
                    checked={selectedTicketId === id}
                    onChange={() => setSelectedTicketId(id)}
                  />
                  <span>
                    <strong>{ticket.seatInfo}</strong>
                    <span className="table-subtext"> {ticketPriceOf(ticket, event)} WEI</span>
                  </span>
                  <span className="badge neutral">{ticket.status}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="lead">구매 가능한 1차 티켓이 없습니다.</p>
      )}

      <div className="action-row">
        <button className="button primary" disabled={!selectedTicketId} onClick={() => void onPrimaryPurchase()}>
          선택한 티켓 구매
        </button>
      </div>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
