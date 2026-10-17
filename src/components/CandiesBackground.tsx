const CANDIES = [
  { e: "🍬", top: "8%", left: "4%", d: "0s" },
  { e: "🍭", top: "22%", left: "90%", d: "1.5s" },
  { e: "🍫", top: "55%", left: "6%", d: "3s" },
  { e: "🍬", top: "78%", left: "86%", d: "0.8s" },
  { e: "🧁", top: "88%", left: "30%", d: "2.2s" },
  { e: "🍭", top: "40%", left: "50%", d: "4s" },
  { e: "🍩", top: "12%", left: "62%", d: "2.8s" },
];

export function CandiesBackground() {
  return (
    <div className="candies-bg" aria-hidden>
      {CANDIES.map((c, i) => (
        <span key={i} style={{ top: c.top, left: c.left, animationDelay: c.d }}>
          {c.e}
        </span>
      ))}
    </div>
  );
}
