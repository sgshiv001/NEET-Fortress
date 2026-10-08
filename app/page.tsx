export default function Home() {
  return (
    <main className="site-frame">
      <iframe
        src="/fortress/index.html"
        title="NEET Fortress exam security platform"
        allow="camera; microphone; clipboard-write"
      />
      <noscript>
        <p>NEET Fortress requires JavaScript to run the exam security dashboard.</p>
      </noscript>
    </main>
  );
}
