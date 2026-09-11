(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const palettes = {
    festival: ['#d34c63','#e6aa35','#168e80','#3674c9','#8d589e','#d76b36'],
    golf: ['#12664d','#e0b84c','#287faf','#e4eadf','#ab445d','#508956'],
    pastel: ['#f3b5c0','#f2d699','#a8d8cc','#a9c9ef','#cbb9e3','#edc2a3']
  };
  let colors = [...palettes.festival], entries = [], history = [], wheel, spinning = false;
  let selected = null, removed = false, snapshot = [], logoUrl = '', backgroundUrl = '';
  let imageLoads = 0;
  let celebrationFrame = 0;
  function stopCelebration() {
    cancelAnimationFrame(celebrationFrame);
    celebrationFrame = 0;
    const canvas = $('celebrationCanvas');
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }
  function celebrate() {
    stopCelebration();
    if (!$('celebrateWinner').checked || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = $('celebrationCanvas'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = innerWidth, height = innerHeight, ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const particles = [], start = performance.now();
    let previous = start, nextBurst = 0;
    const fireColors = ['#ffce4b','#ff6c89','#65e4ce','#79b6ff','#ffffff'];
    function burst(x, y) {
      for (let i = 0; i < 64; i++) {
        const angle = Math.PI * 2 * i / 64, speed = 70 + Math.random() * 160;
        particles.push({ x, y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
          age:0, life:1.1+Math.random()*.7, color:fireColors[i%fireColors.length] });
      }
    }
    function frame(now) {
      if (!$('winnerDialog').open) { stopCelebration(); return; }
      const elapsed = now - start, dt = Math.min((now - previous)/1000, .04); previous = now;
      ctx.clearRect(0,0,width,height);
      if (elapsed >= nextBurst && elapsed < 3200) {
        burst(width*(.1+Math.random()*.25), height*(.12+Math.random()*.35));
        burst(width*(.65+Math.random()*.25), height*(.12+Math.random()*.35));
        nextBurst = elapsed + 650;
      }
      for(let i=particles.length-1;i>=0;i--) {
        const p=particles[i]; p.age+=dt;
        if(p.age>=p.life) { particles.splice(i,1); continue; }
        const oldX=p.x, oldY=p.y;
        p.vy+=90*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
        ctx.globalAlpha=Math.pow(1-p.age/p.life,.6);
        ctx.strokeStyle=p.color; ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(oldX,oldY); ctx.lineTo(p.x,p.y); ctx.stroke();
      }
      ctx.globalAlpha=1;
      if(elapsed<5200) celebrationFrame=requestAnimationFrame(frame);
      else stopCelebration();
    }
    celebrationFrame=requestAnimationFrame(frame);
  }
  function message(text = '') { $('wheelMessage').textContent = text; }
  function names() { return $('wheelNames').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
  function showWheel(show) {
    if (spinning) return;
    $('counterView').hidden = show;
    $('wheelView').hidden = !show;
    ['showCounter','showWheel'].forEach((id,i) => {
      $(id).classList.toggle('active', Boolean(i) === show);
      $(id).setAttribute('aria-pressed', String(Boolean(i) === show));
    });
    if (show) requestAnimationFrame(draw);
  }
  function draw() {
    if (spinning || $('wheelView').hidden) return;
    entries = names();
    $('wheelCount').textContent = entries.length + ' คน';
    $('spinStatus').textContent = entries.length ? 'พร้อมสุ่ม ' + entries.length + ' รายชื่อ' : 'ยังไม่มีรายชื่อ';
    $('spinWheel').disabled = !entries.length || imageLoads > 0;
    if (!window.spinWheel) {
      message('โหลดวงล้อไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ');
      $('spinWheel').disabled = true;
      return;
    }
    const props = {
      items: (entries.length ? entries : Array(6).fill('')).map(label => ({label})),
      itemBackgroundColors: colors, itemLabelColors: [$('wheelTextColor').value],
      itemLabelFont: 'system-ui, sans-serif', itemLabelFontSizeMax: Number($('labelSize').value),
      itemLabelRadius: .89, itemLabelRadiusMax: .25,
      lineColor: '#ffffff55', lineWidth: 1, borderColor: '#ffffff', borderWidth: 5,
      radius: .94, pointerAngle: 0, isInteractive: false,
      onRest: finish
    };
    if (!wheel) wheel = new spinWheel.Wheel($('wheelCanvas'), props);
    else wheel.init({...props, rotation: wheel.rotation});
  }
  function swatches() {
    $('wheelSwatches').replaceChildren(...colors.map((color,i) => {
      const input = document.createElement('input'); input.type = 'color'; input.value = color;
      input.setAttribute('aria-label', 'สีช่องที่ ' + (i+1));
      input.addEventListener('input', () => { colors[i] = input.value; $('wheelTheme').value = 'custom'; draw(); });
      return input;
    }));
  }
  function importNames() {
    if (spinning) return;
    showWheel(true);
    if (!included.length) { message('ยังไม่มีรายชื่อจากผลวิเคราะห์'); return; }
    $('wheelNames').value = included.map(x => x.name).join('\n');
    message(); draw();
  }
  // Rejection sampling avoids modulo bias; each displayed entry has one equal chance.
  function randomIndex(length) {
    const limit = Math.floor(4294967296 / length) * length;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % length;
  }
  function spin() {
    if (spinning || !wheel || !entries.length || imageLoads) return;
    snapshot = [...entries]; selected = randomIndex(snapshot.length); removed = false;
    spinning = true;
    $('wheelSettings').disabled = true;
    ['spinWheel','showCounter','showWheel','sendToWheel'].forEach(id => $(id).disabled = true);
    $('spinStatus').textContent = 'กำลังหมุน…';
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : Number($('spinDuration').value) * 1000;
    wheel.spinToItem(selected, duration, true, 5, 1, t => 1 - Math.pow(1-t, 4));
  }
  function finish(event) {
    if (!spinning) return;
    spinning = false;
    $('wheelSettings').disabled = false;
    ['spinWheel','showCounter','showWheel','sendToWheel'].forEach(id => $(id).disabled = false);
    if (event.currentIndex !== selected) {
      message('ตำแหน่งวงล้อไม่ตรงกับผลสุ่ม กรุณาลองใหม่'); draw(); return;
    }
    const name = snapshot[selected];
    history.push({name, time:new Date().toLocaleString('th-TH')}); renderHistory();
    $('winnerName').textContent = name;
    $('spinStatus').textContent = 'ผู้โชคดี: ' + name;
    $('removeWinner').disabled = false; $('winnerNote').textContent = '';
    if ($('autoRemove').checked) removeWinner();
    // Keep the result dialog visible while the stage is in fullscreen.
    (document.fullscreenElement || document.querySelector('main')).appendChild($('winnerDialog'));
    $('winnerDialog').showModal();
    celebrate();
  }
  function removeWinner() {
    if (removed || selected === null) return;
    const winner = snapshot[selected];
    $('wheelNames').value = names().filter(name => name !== winner).join('\n');
    removed = true; $('removeWinner').disabled = true;
    $('winnerNote').textContent = 'นำชื่อนี้ออกจากวงล้อแล้ว'; draw();
  }
  function renderHistory() {
    $('historyCount').textContent = history.length;
    $('winnerHistory').replaceChildren(...history.map(item => {
      const li = document.createElement('li'); li.textContent = item.name;
      const time = document.createElement('time'); time.textContent = item.time; li.append(time); return li;
    }));
  }
  async function uploadImage(input, kind) {
    const file = input.files[0];
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10*1024*1024) {
      message('เลือกไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 10 MB'); input.value = ''; return;
    }
    imageLoads++; $('spinWheel').disabled = true;
    const url = URL.createObjectURL(file), img = new Image();
    try {
      img.src = url; await img.decode();
      if (kind === 'logo') {
        if (logoUrl) URL.revokeObjectURL(logoUrl); logoUrl = url;
        $('wheelLogo').src = url; $('wheelLogo').hidden = false; $('hubText').hidden = true;
      } else {
        if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); backgroundUrl = url;
        $('wheelStage').style.backgroundImage = `url("${url}")`;
      }
      message();
    } catch { URL.revokeObjectURL(url); message('อ่านรูปนี้ไม่ได้ กรุณาเลือกไฟล์ใหม่'); }
    finally { imageLoads--; input.value = ''; draw(); }
  }
  $('showCounter').onclick = () => showWheel(false);
  $('showWheel').onclick = () => showWheel(true);
  $('sendToWheel').onclick = importNames; $('importWheel').onclick = importNames;
  $('wheelNames').oninput = () => { message(); draw(); };
  $('uniqueWheel').onclick = () => { $('wheelNames').value = [...new Set(names())].join('\n'); draw(); };
  $('wheelTitle').oninput = () => { $('wheelHeading').textContent = $('wheelTitle').value || 'วงล้อผู้โชคดี'; };
  $('wheelTheme').onchange = () => {
    if (palettes[$('wheelTheme').value]) colors = [...palettes[$('wheelTheme').value]];
    $('wheelTextColor').value = $('wheelTheme').value === 'pastel' ? '#24323a' : '#ffffff'; swatches(); draw();
  };
  $('wheelTextColor').oninput = draw;
  function setLabelSize(value) {
    const size = Math.max(4, Math.min(48, Math.round(Number(value)) || 20));
    $('labelSize').value = size; $('labelSizeNumber').value = size; draw();
  }
  $('labelSize').oninput = () => setLabelSize($('labelSize').value);
  $('labelSizeNumber').oninput = () => {
    if ($('labelSizeNumber').value !== '') setLabelSize($('labelSizeNumber').value);
  };
  $('labelSizeNumber').onchange = () => setLabelSize($('labelSizeNumber').value);
  $('fitLabels').onclick = () => setLabelSize(Math.min(20, Math.floor(800 / Math.max(names().length, 1))));
  $('spinDuration').oninput = () => { $('durationLabel').textContent = $('spinDuration').value; };
  $('logoSize').oninput = () => { document.querySelector('.wheel-hub').style.width = $('logoSize').value + '%'; };
  $('logoFile').onchange = event => uploadImage(event.target, 'logo');
  $('backgroundFile').onchange = event => uploadImage(event.target, 'background');
  $('removeLogo').onclick = () => {
    $('wheelLogo').hidden = true; $('wheelLogo').removeAttribute('src'); $('hubText').hidden = false;
    URL.revokeObjectURL(logoUrl); logoUrl = '';
  };
  $('removeBackground').onclick = () => { $('wheelStage').style.backgroundImage = ''; URL.revokeObjectURL(backgroundUrl); backgroundUrl = ''; };
  $('spinWheel').onclick = spin;
  $('closeWinner').onclick = () => $('winnerDialog').close();
  $('winnerDialog').addEventListener('close', stopCelebration);
  $('winnerDialog').addEventListener('cancel', stopCelebration);
  $('removeWinner').onclick = removeWinner;
  $('clearWinners').onclick = () => { history = []; renderHistory(); };
  $('downloadWinners').onclick = () => {
    if (!history.length) { message('ยังไม่มีประวัติผู้ชนะ'); return; }
    const url = URL.createObjectURL(new Blob([history.map((x,i) => `${i+1}. ${x.name}\t${x.time}`).join('\n')],{type:'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'wheel-winners.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  $('presentWheel').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('wheelStage').requestFullscreen) await $('wheelStage').requestFullscreen();
      else document.body.classList.toggle('presenting');
    } catch { document.body.classList.toggle('presenting'); }
    $('presentWheel').textContent = document.fullscreenElement || document.body.classList.contains('presenting') ? 'ออกเต็มหน้าจอ' : 'เต็มหน้าจอ';
  };
  document.addEventListener('fullscreenchange', () => { $('presentWheel').textContent = document.fullscreenElement ? 'ออกเต็มหน้าจอ' : 'เต็มหน้าจอ'; });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') { document.body.classList.remove('presenting'); $('presentWheel').textContent = document.fullscreenElement ? 'ออกเต็มหน้าจอ' : 'เต็มหน้าจอ'; } });
  swatches();
})();
