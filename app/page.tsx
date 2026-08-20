export default function Home() {
  return (
    <main className="site-frame">
      <iframe
        src="/fortress/index.html"
        title="NEET Fortress v4 examination security command center"
        allow="camera; microphone; clipboard-write"
      />
      <noscript>
        <p>NEET Fortress requires JavaScript for its offline operational simulations.</p>
      </noscript>
    </main>
  );
}
