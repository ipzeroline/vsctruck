import Link from "next/link";

export default function NotFound() {
  return (
    <main className="dashboard-loading">
      <section className="panel error-panel">
        <p className="eyebrow">404</p>
        <h1>ไม่พบหน้าที่ต้องการ</h1>
        <p>URL นี้ไม่มีอยู่ในระบบ VSCTruck</p>
        <Link className="button" href="/">
          กลับ Dashboard
        </Link>
      </section>
    </main>
  );
}
