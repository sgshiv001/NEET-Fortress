export default function Home() {
  return (
    <main className="site-frame">
      <iframe
        src="/fortress/index.html"
        title="NEET Fortress v5 AI examination security command center"
        allow="camera; microphone; clipboard-write"
      />
      <noscript>
        <p>NEET Fortress requires JavaScript for its offline operational simulations.</p>
      </noscript>
    </main>
  );
}
