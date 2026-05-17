import { FormEvent, useState } from "react";
import { backendApi } from "../../lib/backend";

export function EventCreatePage() {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [eventDateTime, setEventDateTime] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      title,
      venue,
      eventDateTime,
      ticketPrice: "100000000000000000",
      totalTicketCount: 100,
      primarySaleStart: Math.floor(Date.now() / 1000),
      primarySaleEnd: Math.floor(Date.now() / 1000) + 86400,
      resaleAllowed: true,
      maxResalePriceRate: 12000,
      resaleStart: Math.floor(Date.now() / 1000) + 86400,
      resaleEnd: Math.floor(Date.now() / 1000) + 86400 * 7,
    };
    const result = await backendApi.createEvent(payload);
    setMessage(`Created eventId: ${result.id ?? result.eventId}`);
  }

  return (
    <section className="panel">
      <h2>이벤트 등록</h2>
      <form className="form" onSubmit={onSubmit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이벤트명" />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="장소" />
        <input
          value={eventDateTime}
          onChange={(e) => setEventDateTime(e.target.value)}
          placeholder="2026-12-24T19:00:00"
        />
        <button className="button primary" type="submit">
          등록
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
