"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-loading">
      <section className="panel error-panel">
        <p className="eyebrow">Application error</p>
        <h1>โหลดข้อมูลไม่สำเร็จ</h1>
        <p>ระบบพบข้อผิดพลาดระหว่างแสดงผล กรุณาลองใหม่อีกครั้ง</p>
        <button className="button" onClick={reset}>
          ลองใหม่
        </button>
      </section>
    </main>
  );
}
