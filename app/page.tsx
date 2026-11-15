export default function Home() {
  return (
    <main className="site-frame">
      <iframe
        src="/fortress/index.html"
        title="Exam Fortress exam security workspace"
        allow="camera; microphone; clipboard-write"
      />
      <noscript>
        <p>Exam Fortress requires JavaScript to run the exam security workspace.</p>
      </noscript>
    </main>
  );
}
