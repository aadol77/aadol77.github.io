(() => {
  const $ = (selector) => document.querySelector(selector);
  const year = $("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = $(".menu-toggle");
  const siteNav = $("#site-nav");
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    siteNav.classList.toggle("is-open", !open);
  });
  siteNav?.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      menuToggle?.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
    }
  });

  const canvas = $("#game-canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const scoreElement = $("#score");
  const highScoreElement = $("#high-score");
  const livesElement = $("#lives");
  const enemyCountElement = $("#enemy-count");
  const healthBar = $("#health-bar");
  const statusElement = $("#game-status");
  const overlay = $("#game-overlay");
  const overlayTitle = $("#overlay-title");
  const overlayCopy = $("#overlay-copy");
  const startButton = $("#start-button");
  const pauseButton = $("#pause-button");
  const restartButton = $("#restart-button");

  const cell = 20;
  const columns = canvas.width / cell;
  const rows = canvas.height / cell;
  const tickSpeed = 180;
  const enemySpawnInterval = 60000;
  const maxEnemies = 4;
  const directions = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const state = {
    status: "ready", timer: null, tick: 0, elapsedMs: 0, score: 0, lives: 3,
    highScore: Number(localStorage.getItem("hongsuk-kim-worm-high-score") || 0),
    snake: [], direction: { x: 1, y: 0 }, nextDirection: { x: 1, y: 0 },
    food: { x: 14, y: 8 }, enemies: [{ x: 19, y: 5, dx: -1, dy: 0 }],
    invincibleUntil: 0, particles: []
  };
  highScoreElement.textContent = state.highScore;

  const resetSnake = () => {
    state.snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
  };
  const isOccupied = (point) => state.snake.some((segment) => segment.x === point.x && segment.y === point.y) || state.enemies.some((enemy) => enemy.x === point.x && enemy.y === point.y);
  const randomPoint = () => ({ x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) });
  const spawnFood = () => {
    let point = randomPoint();
    let attempts = 0;
    while (isOccupied(point) && attempts < 100) { point = randomPoint(); attempts += 1; }
    state.food = point;
  };
  const setStatus = (message) => { statusElement.textContent = message; };
  const updateStats = () => {
    scoreElement.textContent = state.score;
    highScoreElement.textContent = state.highScore;
    livesElement.textContent = state.lives;
    if (enemyCountElement) enemyCountElement.textContent = `${state.enemies.length} / ${maxEnemies}`;
    healthBar?.querySelectorAll(".health-cell").forEach((cell, index) => cell.classList.toggle("is-active", index < state.lives));
    healthBar?.setAttribute("aria-label", `${state.lives} health remaining`);
  };
  const showOverlay = (title, copy) => {
    overlayTitle.textContent = title; overlayCopy.textContent = copy; overlay.classList.remove("is-hidden");
  };
  const hideOverlay = () => overlay.classList.add("is-hidden");
  const stopTimer = () => { if (state.timer !== null) { clearInterval(state.timer); state.timer = null; } };
  const startTimer = () => { stopTimer(); state.timer = window.setInterval(step, tickSpeed); };

  const explode = (x, y) => {
    for (let index = 0; index < 22; index += 1) {
      const angle = (Math.PI * 2 * index) / 22;
      state.particles.push({ x: x * cell + cell / 2, y: y * cell + cell / 2, vx: Math.cos(angle) * (1 + Math.random() * 2), vy: Math.sin(angle) * (1 + Math.random() * 2), life: 1 });
    }
  };
  const loseLife = () => {
    if (performance.now() < state.invincibleUntil) return false;
    const head = state.snake[0];
    explode(head.x, head.y);
    state.lives -= 1;
    updateStats();
    if (state.lives <= 0) { endGame(); return true; }
    state.invincibleUntil = performance.now() + 1000;
    resetSnake();
    setStatus("Collision! Invulnerable for 1 second.");
    return true;
  };
  const moveEnemies = () => {
    state.enemies.forEach((enemy) => {
      if (state.tick % 3 === 0 && Math.random() < 0.45) {
        const choices = Object.values(directions).filter((direction) => direction.x !== -enemy.dx || direction.y !== -enemy.dy);
        const next = choices[Math.floor(Math.random() * choices.length)];
        enemy.dx = next.x; enemy.dy = next.y;
      }
      const next = { x: enemy.x + enemy.dx, y: enemy.y + enemy.dy };
      if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows) { enemy.dx *= -1; enemy.dy *= -1; return; }
      enemy.x = next.x; enemy.y = next.y;
    });
  };
  const spawnEnemy = () => {
    if (state.enemies.length >= maxEnemies) return false;
    let point = randomPoint();
    let attempts = 0;
    while ((isOccupied(point) || (point.x === state.food.x && point.y === state.food.y)) && attempts < 100) { point = randomPoint(); attempts += 1; }
    const options = Object.values(directions);
    const direction = options[Math.floor(Math.random() * options.length)];
    state.enemies.push({ x: point.x, y: point.y, dx: direction.x, dy: direction.y });
    updateStats();
    return true;
  };
  function step() {
    if (state.status !== "running") return;
    state.tick += 1;
    state.elapsedMs += tickSpeed;
    state.direction = state.nextDirection;
    const head = state.snake[0];
    const nextHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };
    const hitWall = nextHead.x < 0 || nextHead.x >= columns || nextHead.y < 0 || nextHead.y >= rows;
    const hitSelf = state.snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    if (hitWall || hitSelf) { loseLife(); return; }
    state.snake.unshift(nextHead);
    if (nextHead.x === state.food.x && nextHead.y === state.food.y) { state.score += 10; if (state.score > state.highScore) { state.highScore = state.score; localStorage.setItem("hongsuk-kim-worm-high-score", String(state.highScore)); } spawnFood(); } else { state.snake.pop(); }
    moveEnemies();
    if (state.enemies.some((enemy) => nextHead.x === enemy.x && nextHead.y === enemy.y)) { state.snake.shift(); loseLife(); return; }
    if (state.elapsedMs >= enemySpawnInterval) { state.elapsedMs = 0; spawnEnemy(); }
    setStatus(state.invincibleUntil > performance.now() ? `Invulnerable · Enemies ${state.enemies.length}/${maxEnemies}` : `Game in progress · Enemies ${state.enemies.length}/${maxEnemies}`);
    updateStats();
  }
  function startGame() {
    stopTimer(); resetSnake(); state.score = 0; state.lives = 3; state.tick = 0; state.elapsedMs = 0; state.invincibleUntil = 0; state.enemies = [{ x: 19, y: 5, dx: -1, dy: 0 }]; state.status = "running"; spawnFood(); updateStats(); hideOverlay(); pauseButton.disabled = false; pauseButton.textContent = "Pause"; setStatus(`Game in progress · Enemies 1/${maxEnemies}`); startTimer();
  }
  function endGame() { stopTimer(); state.status = "gameover"; pauseButton.disabled = true; showOverlay("GAME OVER", `Final score ${state.score} · Press Restart to try again.`); setStatus("Game over"); }
  function togglePause() { if (state.status === "running") { state.status = "paused"; stopTimer(); pauseButton.textContent = "Resume"; showOverlay("PAUSED", "Press Resume to continue."); setStatus("Paused"); } else if (state.status === "paused") { state.status = "running"; pauseButton.textContent = "Pause"; hideOverlay(); setStatus("Game in progress"); startTimer(); } }
  const setDirection = (directionName) => {
    if (state.status !== "running") return;
    const next = directions[directionName];
    if (!next || (next.x === -state.direction.x && next.y === -state.direction.y)) return;
    state.nextDirection = next;
  };

  const draw = () => {
    context.fillStyle = "#020402"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(101,255,127,.08)"; context.lineWidth = 1;
    for (let x = 0; x <= columns; x += 1) { context.beginPath(); context.moveTo(x * cell, 0); context.lineTo(x * cell, canvas.height); context.stroke(); }
    for (let y = 0; y <= rows; y += 1) { context.beginPath(); context.moveTo(0, y * cell); context.lineTo(canvas.width, y * cell); context.stroke(); }
    context.fillStyle = "#ff6c74"; context.shadowColor = "#ff6c74"; context.shadowBlur = 12; state.enemies.forEach((enemy) => context.fillRect(enemy.x * cell + 4, enemy.y * cell + 4, cell - 8, cell - 8)); context.shadowBlur = 0;
    context.fillStyle = "#d8ffdc"; context.shadowColor = "#65ff7f"; context.shadowBlur = 14; context.fillRect(state.food.x * cell + 5, state.food.y * cell + 5, cell - 10, cell - 10); context.shadowBlur = 0;
    state.snake.forEach((segment, index) => { const visible = performance.now() >= state.invincibleUntil || Math.floor(performance.now() / 90) % 2 === 0; if (!visible) return; context.fillStyle = index === 0 ? "#d8ffdc" : "#65ff7f"; context.fillRect(segment.x * cell + 2, segment.y * cell + 2, cell - 4, cell - 4); });
    state.particles = state.particles.filter((particle) => particle.life > 0); state.particles.forEach((particle) => { particle.x += particle.vx; particle.y += particle.vy; particle.life -= .035; context.globalAlpha = Math.max(0, particle.life); context.fillStyle = "#ffb3b7"; context.fillRect(particle.x, particle.y, 3, 3); }); context.globalAlpha = 1;
    window.requestAnimationFrame(draw);
  };

  startButton.addEventListener("click", startGame); restartButton.addEventListener("click", startGame); pauseButton.addEventListener("click", togglePause);
  document.querySelectorAll("[data-direction]").forEach((button) => button.addEventListener("click", () => setDirection(button.dataset.direction)));
  document.addEventListener("keydown", (event) => { const keys = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" }; if (keys[event.key]) { event.preventDefault(); setDirection(keys[event.key]); } if (event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); } });
  window.addEventListener("blur", () => { if (state.status === "running") togglePause(); });
  resetSnake(); updateStats(); draw();
})();
