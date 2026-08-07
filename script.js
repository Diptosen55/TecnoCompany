import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDFUpRcLR-3DnxQqfOhVOgDgvHb2yY-d50",
    authDomain: "tecno-company.firebaseapp.com",
    projectId: "tecno-company",
    storageBucket: "tecno-company.firebasestorage.app",
    messagingSenderId: "385315177621",
    appId: "1:385315177621:web:cb5b49f4432d5ab82e079c",
    measurementId: "G-34JND8KSGY"
};

const app = initializeApp(firebaseConfig); 
const auth = getAuth(app); 
const db = getFirestore(app);

let activeUserId = null, activeUserPhone = null, currentBalance = 0, myInviteCode = "", referredByCode = "none";
let appConfig = { welcomeBonus: 0, minDeposit: 150, maxWithdraw: 20000, minWithdraw: 150, refCommission: 31, adminBkash: "01700000000", adminNagad: "01800000000", methods: ["বিকাশ", "নগদ"], slides: [], supportTelegram: "", supportWhatsApp: "" };
window.claimTimerInterval = null; 

window.showToast = (msg, isSuccess=false) => { 
    const t = document.getElementById('custom-toast'); 
    t.textContent = msg; 
    t.style.backgroundColor = isSuccess ? '#10b981' : '#f43f5e'; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 3000); 
};

window.withLoading = (fn, delay=600) => { 
    const l = document.getElementById('global-loader'); 
    l.classList.add('active'); 
    setTimeout(() => { l.classList.remove('active'); fn(); }, delay); 
};

window.switchAppView = (vid) => { 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); 
    document.getElementById(vid).classList.add('active'); 
    document.getElementById('main-nav').style.display = ['home-view','team-view','withdraw-view','mine-view'].includes(vid) ? 'flex' : 'none'; 
};

window.switchMainTab = (vid, el) => { 
    if(!el) return; 
    window.withLoading(() => { 
        window.switchAppView(vid); 
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active')); 
        el.classList.add('active'); 
    }, 300); 
};

window.showModal = id => document.getElementById(id).classList.add('active');

window.closeModal = id => { 
    document.getElementById(id).classList.remove('active'); 
    if(id === 'my-products-modal' && window.claimTimerInterval) clearInterval(window.claimTimerInterval);
};

window.confirmAction = (msg, cb) => { 
    document.getElementById('confirm-msg').innerText = msg; 
    document.getElementById('confirm-yes-btn').onclick = () => { closeModal('confirm-modal'); cb(); }; 
    showModal('confirm-modal'); 
};

window.togglePassword = btn => { 
    const i = btn.previousElementSibling; 
    i.type = i.type === 'password' ? 'text' : 'password'; 
};

window.copyTextToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => window.showToast("কপি হয়েছে!", true)).catch(() => fallbackCopyTextToClipboard(text));
    } else {
        fallbackCopyTextToClipboard(text);
    }
};

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.top = "0"; 
    textArea.style.left = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if(successful) window.showToast("কপি হয়েছে!", true);
        else window.showToast("কপি করা যায়নি!", false);
    } catch (err) {
        window.showToast("ত্রুটি হয়েছে!", false);
    }
    document.body.removeChild(textArea);
}

let currentValidCaptcha = "";
window.generateCaptcha = () => { 
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; 
    currentValidCaptcha = ""; 
    for(let i=1; i<=4; i++) { 
        const sp = document.querySelector(`.cap-${i}`); 
        if(sp) { 
            const rc = chars.charAt(Math.floor(Math.random() * chars.length)); 
            currentValidCaptcha += rc; 
            sp.innerText = rc; 
            sp.style.transform = `rotate(${Math.floor(Math.random() * 40) - 20}deg)`; 
        } 
    } 
};

onSnapshot(doc(db, 'settings', 'config'), (snap) => { 
    if(snap.exists()) { 
        appConfig = { ...appConfig, ...snap.data() }; 
        updateConfigUI(); 
    } 
});

function updateConfigUI() {
    document.getElementById('withdraw-rule-text').innerText = `• সর্বনিম্ন ${appConfig.minWithdraw || 0} টাকা থেকে সর্বোচ্চ ${appConfig.maxWithdraw || 0} টাকা পর্যন্ত তোলা যাবে।`;
    document.getElementById('min-dep-text').innerText = `(সর্বনিম্ন ৳${appConfig.minDeposit || 0})`;
    document.getElementById('support-tg-btn').href = appConfig.supportTelegram || "#";
    document.getElementById('support-wa-btn').href = appConfig.supportWhatsApp || "#";
    
    document.getElementById('ref-comm-text-display').innerText = (appConfig.refCommission || 31) + '%';
    
    const methodOpts = (appConfig.methods || []).map(m => `<option value="${m}">${m}</option>`).join('');
    document.getElementById('rech-method').innerHTML = methodOpts; 
    document.getElementById('bank-name').innerHTML = methodOpts;
    updateAdminNumberUI();

    const sliderContainer = document.getElementById('home-slider');
    sliderContainer.innerHTML = (appConfig.slides || []).map(url => `<div class="slide"><img src="${url}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Not+Found'"></div>`).join('');
    startSlider();
}

window.updateAdminNumberUI = () => {
    const method = document.getElementById('rech-method').value.toLowerCase(); 
    const el = document.getElementById('admin-payment-number');
    if(method.includes('bkash') || method.includes('বিকাশ')) el.innerText = appConfig.adminBkash || "---";
    else if(method.includes('nagad') || method.includes('নগদ')) el.innerText = appConfig.adminNagad || "---";
    else el.innerText = "প্রযোজ্য নয়";
};

window.copyAdminNumber = () => {
    const txt = document.getElementById('admin-payment-number').innerText;
    if(txt && txt !== "---" && txt !== "প্রযোজ্য নয়") {
        copyTextToClipboard(txt);
    }
};

window.copyInviteCode = () => { 
    copyTextToClipboard(myInviteCode); 
};

onSnapshot(collection(db, 'products'), (snap) => {
    let productsHTML = ''; let prods = []; 
    snap.forEach(d => prods.push({id: d.id, ...d.data()}));
    prods.sort((a,b) => a.order - b.order).forEach(p => { productsHTML += buildProductCard(p); });
    const prodList = document.getElementById('product-list');
    if(prods.length > 0) prodList.innerHTML = productsHTML; 
    else prodList.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); font-weight: 600; padding: 20px;">কোনো প্ল্যান নেই</div>`;
});

function buildProductCard(p) {
    const totalIncome = parseInt(p.duration) * parseFloat(p.dailyIncome);
    return `<div class="product-card"><div class="card-badge">${p.name}</div><div class="card-row"><span>মেয়াদ</span><span>${p.duration}</span></div><div class="card-row"><span>দৈনিক আয়</span><span style="color:#10b981;">৳${p.dailyIncome}</span></div><div class="card-row" style="border-top: 1px dashed #e2e8f0; margin-top: 8px; padding-top: 8px;"><span>মোট আয়</span><span style="color:#a855f7; font-weight: 800;">৳${totalIncome}</span></div><div class="card-footer"><div class="price">৳${p.price}</div><button class="buy-btn" onclick="buyProduct(${p.price}, '${p.name}', ${p.dailyIncome}, '${p.duration}')">+</button></div></div>`;
}

window.handleRegister = async e => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value.trim(); 
    const pass = document.getElementById('reg-pass').value.trim(); 
    const conf = document.getElementById('reg-pass-conf').value.trim(); 
    const captcha = document.getElementById('reg-captcha').value.trim(); 
    const invite = document.getElementById('reg-invite').value.trim();
    
    if(!phone||!pass) return window.showToast("তথ্য পূরণ করুন!", false); 
    if(captcha !== currentValidCaptcha){ window.generateCaptcha(); return window.showToast("ক্যাপচা ভুল!", false); } 
    if(pass !== conf) return window.showToast("পাসওয়ার্ড মেলেনি!", false);

    document.getElementById('global-loader').classList.add('active');
    try {
        const userCred = await createUserWithEmailAndPassword(auth, phone+"@tecno.app", pass);
        const newCode = "Tecno" + Math.random().toString(36).substring(2,6).toUpperCase();
        const welcomeAmt = Number(appConfig.welcomeBonus) || 0;
        await setDoc(doc(db, "users", userCred.user.uid), { phone: phone, balance: welcomeAmt, inviteCode: newCode, referredBy: invite || "none", createdAt: new Date().toISOString(), bankName: "", bankNumber: "", banks: {}, isBanned: false });
        window.showToast("নিবন্ধন সফল!", true);
    } catch(e) { 
        document.getElementById('global-loader').classList.remove('active'); 
        window.showToast("সমস্যা হয়েছে: "+e.message, false); 
    }
};

window.handleLogin = async e => { 
    e.preventDefault(); 
    const ph = document.getElementById('login-phone').value.trim(); 
    const pw = document.getElementById('login-pass').value.trim(); 
    if(!ph||!pw) return; 
    document.getElementById('global-loader').classList.add('active'); 
    try { 
        const cred = await signInWithEmailAndPassword(auth, ph+"@tecno.app", pw); 
        const userDoc = await getDoc(doc(db, "users", cred.user.uid));
        if (!userDoc.exists()) {
            await signOut(auth);
            document.getElementById('global-loader').classList.remove('active');
            return window.showToast("আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে!", false);
        }
        window.showToast("লগইন সফল!", true); 
    } catch(e) { 
        document.getElementById('global-loader').classList.remove('active'); 
        window.showToast("ভুল তথ্য!", false); 
    } 
};

window.handleLogout = async () => { 
    window.withLoading(async()=>{ 
        await signOut(auth); 
        window.showToast("লগআউট হয়েছে", true); 
    }); 
};

window.saveBankInfo = async () => { 
    const bName = document.getElementById('bank-name').value; 
    const bNum = document.getElementById('bank-number').value.trim(); 
    if(!bNum) return window.showToast("নম্বর দিন!", false); 
    
    window.withLoading(async()=>{ 
        // ডাটাবেসে মাল্টিপল ব্যাংক সেভ করার সিস্টেম যুক্ত করা হলো
        await updateDoc(doc(db, "users", activeUserId), { 
            [`banks.${bName}`]: bNum, 
            bankName: bName, 
            bankNumber: bNum 
        }); 
        window.showToast(`${bName} যুক্ত হয়েছে!`, true); 
        closeModal('bank-modal'); 
    }, 500); 
};

window.handleRecharge = async e => {
    e.preventDefault();
    const meth = document.getElementById('rech-method').value; 
    const amt = Number(document.getElementById('rech-amount').value.trim()); 
    const trx = document.getElementById('rech-trx').value.trim();
    if(!amt || !trx) return window.showToast("সঠিক তথ্য দিন!", false); 
    if(amt < appConfig.minDeposit) return window.showToast(`সর্বনিম্ন ${appConfig.minDeposit} টাকা!`, false);
    
    window.withLoading(async()=>{ 
        await addDoc(collection(db, "transactions"), { uid: activeUserId, type: "Deposit", method: meth, amount: amt, trxId: trx, status: "Pending", timestamp: new Date().toISOString() }); 
        window.showToast("রিকোয়েস্ট পাঠানো হয়েছে!", true); 
        e.target.reset(); 
        window.switchAppView('mine-view'); 
    }, 800);
};

window.handleWithdraw = async () => {
    const amt = Number(document.getElementById('withdraw-amount').value.trim()); 
    const bank = document.getElementById('withdraw-bank-select').value;
    if(!bank) return window.showToast("ব্যাংক যুক্ত করুন!", false); 
    if(!amt || amt < appConfig.minWithdraw) return window.showToast(`সর্বনিম্ন ${appConfig.minWithdraw} টাকা!`, false); 
    if(amt > currentBalance) return window.showToast("পর্যাপ্ত টাকা নেই!", false);
    
    window.withLoading(async()=>{ 
        await updateDoc(doc(db, "users", activeUserId), { balance: currentBalance - amt }); 
        await addDoc(collection(db, "transactions"), { uid: activeUserId, type: "Withdraw", amount: amt, status: "Pending", method: bank, timestamp: new Date().toISOString() }); 
        window.showToast("অনুরোধ সফল!", true); 
        document.getElementById('withdraw-amount').value = ''; 
        loadWithdrawRecords(); 
    }, 800);
};

window.buyProduct = (price, name, daily, durationStr) => {
    if(currentBalance < price) return window.showToast("পর্যাপ্ত ব্যালেন্স নেই!", false);
    confirmAction(`৳${price} দিয়ে ${name} কিনতে চান?`, async () => {
        window.withLoading(async () => {
            try {
                await updateDoc(doc(db, "users", activeUserId), { balance: currentBalance - price });
                // lastClaimed: 0 এর পরিবর্তে Date.now() দেওয়া হলো, যাতে সাথে সাথে ক্লেইম করা না যায়
                await addDoc(collection(db, "my_products"), { uid: activeUserId, name: name, price: price, dailyIncome: daily, duration: durationStr, purchaseDate: new Date().toISOString(), claimedDays: 0, lastClaimed: Date.now() });
                await addDoc(collection(db, "transactions"), { uid: activeUserId, type: "Purchase", amount: price, status: "Success", details: name, timestamp: new Date().toISOString() });
                
                if (referredByCode && referredByCode !== "none") {
                    const q = query(collection(db, "users"), where("inviteCode", "==", referredByCode));
                    const snap = await getDocs(q);
                    if(!snap.empty) {
                        const refUserDoc = snap.docs[0]; const refData = refUserDoc.data(); 
                        const commissionRate = Number(appConfig.refCommission) || 31;
                        const bonusAmount = Math.floor(price * (commissionRate / 100));
                        await updateDoc(doc(db, "users", refUserDoc.id), { balance: refData.balance + bonusAmount });
                        await addDoc(collection(db, "transactions"), { uid: refUserDoc.id, type: "Commission", amount: bonusAmount, status: "Success", details: `রেফার: ${activeUserPhone}`, timestamp: new Date().toISOString() });
                    }
                }
                window.showToast("পণ্য কেনা সফল!", true);
            } catch(e) { window.showToast("সমস্যা হয়েছে!", false); }
        }, 800);
    });
};

window.loadMyProducts = async () => {
    const listDiv = document.getElementById('my-products-list');
    listDiv.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    if(window.claimTimerInterval) clearInterval(window.claimTimerInterval);

    try {
        const q = query(collection(db, "my_products"), where("uid", "==", activeUserId));
        const snap = await getDocs(q);
        let html = '';
        
        snap.forEach(d => {
            const data = d.data();
            const docId = d.id;
            const claimedDays = data.claimedDays || 0;
            const lastClaim = data.lastClaimed || 0;
            const totalDays = parseInt(data.duration) || 300; 
            const isExpired = claimedDays >= totalDays;
            const nextClaimTime = lastClaim + (24 * 60 * 60 * 1000);
            const now = Date.now();
            
            let claimBtnHTML = '';
            if (isExpired) claimBtnHTML = `<button class="btn-claim expired" disabled>মেয়াদ শেষ</button>`;
            else if (now < nextClaimTime) claimBtnHTML = `<button class="btn-claim claim-timer-btn" disabled data-next-claim="${nextClaimTime}" data-onclick="claimDaily('${docId}', ${data.dailyIncome}, '${data.name}')">00:00:00</button>`;
            else claimBtnHTML = `<button class="btn-claim" onclick="claimDaily('${docId}', ${data.dailyIncome}, '${data.name}')">রিসিভ করুন</button>`;

            html += `<div class="list-card"><div class="list-card-title">${data.name} <span style="float:right; font-size:11px; color:#64748b;">${claimedDays}/${totalDays} দিন</span></div><div class="list-card-row"><span>মূল্য:</span><span>৳${data.price}</span></div><div class="list-card-row"><span>দৈনিক আয়:</span><span style="color:#10b981;">৳${data.dailyIncome}</span></div><div class="list-card-row" style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; align-items:center;"><div><span style="display:block; font-size:11px; color:#64748b;">মোট আয় হয়েছে</span><span style="font-size:15px; font-weight:800; color:#a855f7;">৳${claimedDays * data.dailyIncome}</span></div>${claimBtnHTML}</div></div>`;
        });
        
        listDiv.innerHTML = html || '<p style="text-align:center;color:#94a3b8;padding:20px;">কোনো পণ্য কেনা হয়নি</p>';
        startClaimTimers(); 
    } catch(e) {}
};

window.claimDaily = async (docId, dailyIncome, name) => {
    window.withLoading(async () => {
        try {
            const prodRef = doc(db, "my_products", docId);
            const prodSnap = await getDoc(prodRef);
            if (!prodSnap.exists()) return window.showToast("পণ্য পাওয়া যায়নি!", false);
            const pData = prodSnap.data();
            
            const lastClaim = pData.lastClaimed || 0;
            if (Date.now() - lastClaim < (24 * 60 * 60 * 1000)) return window.showToast("২৪ ঘণ্টা পার হয়নি!", false);

            const newClaimedDays = (pData.claimedDays || 0) + 1;
            await updateDoc(prodRef, { lastClaimed: Date.now(), claimedDays: newClaimedDays });
            await updateDoc(doc(db, "users", activeUserId), { balance: currentBalance + dailyIncome });
            await addDoc(collection(db, "transactions"), { uid: activeUserId, type: "Daily Income", amount: dailyIncome, status: "Success", details: name, timestamp: new Date().toISOString() });
            
            window.showToast("আয় যুক্ত হয়েছে!", true);
            loadMyProducts(); 
        } catch(e) { window.showToast("ত্রুটি হয়েছে!", false); }
    });
};

function startClaimTimers() {
    if(window.claimTimerInterval) clearInterval(window.claimTimerInterval);
    window.claimTimerInterval = setInterval(() => {
        const btns = document.querySelectorAll('.claim-timer-btn');
        if(btns.length === 0) return;
        const now = Date.now();
        btns.forEach(btn => {
            const nextClaim = parseInt(btn.getAttribute('data-next-claim'));
            const diff = nextClaim - now;
            if (diff <= 0) {
                btn.classList.remove('claim-timer-btn'); btn.removeAttribute('disabled'); btn.innerText = "রিসিভ করুন"; btn.style.background = "var(--primary-grad)"; btn.style.color = "#fff"; btn.setAttribute('onclick', btn.getAttribute('data-onclick'));
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
                const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
                btn.innerText = `${h}:${m}:${s}`;
            }
        });
    }, 1000);
}

window.loadTransactions = async () => {
    const listDiv = document.getElementById('transactions-list');
    listDiv.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    try {
        const q = query(collection(db, "transactions"), where("uid", "==", activeUserId));
        const snap = await getDocs(q);
        let arr = []; snap.forEach(d => arr.push(d.data()));
        arr.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        let html = '';
        arr.forEach(d => {
            let c = d.type==='Withdraw'?'#ef4444' : (d.type==='Purchase'?'#f59e0b' : '#10b981');
            let s = (d.type==='Withdraw'||d.type==='Purchase')?'-':'+';
            html += `<div class="list-card" style="border-left:4px solid ${c};"><div class="list-card-row"><span style="font-weight:800;">${d.type}</span><span style="color:${c};font-weight:800;">${s}৳${d.amount}</span></div><div class="list-card-row" style="font-size:11px; margin-top:5px;"><span>${new Date(d.timestamp).toLocaleDateString('en-GB')}</span><span style="background:#e2e8f0; padding:2px 8px; border-radius:10px;">${d.status}</span></div></div>`;
        });
        listDiv.innerHTML = html || '<p style="text-align:center;color:#94a3b8;padding:20px;">কোনো রেকর্ড নেই</p>';
    } catch(e) {}
};

window.loadTeamRecords = async () => {
    const listDiv = document.getElementById('team-records-list');
    try {
        const userQ = query(collection(db, "users"), where("referredBy", "==", myInviteCode));
        const userSnap = await getDocs(userQ);
        document.getElementById('total-ref-count').innerText = userSnap.size + " জন";
        let html = '';
        userSnap.forEach(d => {
            const u = d.data();
            html += `<div class="list-card"><div class="list-card-row"><span>সদস্য:</span><span style="font-weight:800;">${u.phone}</span></div><div class="list-card-row" style="font-size:11px;"><span>যোগদান:</span><span>${new Date(u.createdAt).toLocaleDateString('en-GB')}</span></div></div>`;
        });
        listDiv.innerHTML = html || '<div class="empty-text">কোনো রেফার নেই</div>';

        const txQ = query(collection(db, "transactions"), where("uid", "==", activeUserId), where("type", "==", "Commission"));
        const txSnap = await getDocs(txQ);
        let tComm = 0; txSnap.forEach(d => tComm += d.data().amount);
        document.getElementById('total-ref-comm').innerText = `৳ ${tComm}`;
    } catch(e) { listDiv.innerHTML = '<div class="empty-text">সমস্যা হয়েছে</div>'; }
};

window.loadWithdrawRecords = async () => {
    const listDiv = document.getElementById('withdraw-records-list');
    try {
        const q = query(collection(db, "transactions"), where("uid", "==", activeUserId), where("type", "==", "Withdraw"));
        const snap = await getDocs(q);
        let arr = []; snap.forEach(d => arr.push(d.data()));
        arr.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        let html = '';
        arr.forEach(d => { html += `<div class="list-card" style="border-left:4px solid #ef4444;"><div class="list-card-row"><span>উত্তোলন</span><span style="color:#ef4444;font-weight:800;">-৳${d.amount}</span></div><div class="list-card-row" style="font-size:11px; margin-top:5px;"><span>${new Date(d.timestamp).toLocaleDateString('en-GB')}</span><span style="background:#e2e8f0; padding:2px 8px; border-radius:10px;">${d.status}</span></div></div>`; });
        listDiv.innerHTML = html || '<div class="empty-text">কোনো রেকর্ড নেই</div>';
    } catch(e) { listDiv.innerHTML = '<div class="empty-text">সমস্যা হয়েছে</div>'; }
};

let slideIndex=0, sliderInterval;
function startSlider() {
    clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        const s = document.getElementById('home-slider');
        const slides = s ? s.querySelectorAll('.slide') : [];
        if(slides.length===0) return;
        slideIndex++; if(slideIndex>=slides.length) slideIndex=0;
        s.scrollTo({ left: slides[slideIndex].offsetLeft, behavior: 'smooth' });
    }, 3000);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        activeUserId = user.uid;
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                if (data.isBanned) {
                    window.showToast("আপনার অ্যাকাউন্ট ব্যান করা হয়েছে!", false);
                    setTimeout(() => { signOut(auth); }, 1500);
                    return;
                }

                currentBalance = data.balance || 0;
                activeUserPhone = data.phone;
                myInviteCode = data.inviteCode || "---";
                referredByCode = data.referredBy || "none";
                
                document.querySelectorAll('.user-balance-display').forEach(el => el.innerText = currentBalance);
                document.getElementById('mine-user-id').innerText = data.phone;
                document.getElementById('my-invite-code').innerText = myInviteCode;
                
                // একাধিক ব্যাংক অপশন যুক্ত করার লজিক
                const bSelect = document.getElementById('withdraw-bank-select');
                let optionsHTML = '';
                let hasBanks = false;
                
                if (data.banks && Object.keys(data.banks).length > 0) {
                    for (let [name, num] of Object.entries(data.banks)) {
                        optionsHTML += `<option value="${name}-${num}">${name} - ${num}</option>`;
                        hasBanks = true;
                    }
                } else if (data.bankName && data.bankNumber) { 
                    optionsHTML += `<option value="${data.bankName}-${data.bankNumber}">${data.bankName} - ${data.bankNumber}</option>`;
                    hasBanks = true;
                }

                if (hasBanks) {
                    bSelect.innerHTML = optionsHTML;
                    document.getElementById('bank-name').value = data.bankName || ""; 
                    document.getElementById('bank-number').value = data.bankNumber || "";
                } else {
                    bSelect.innerHTML = '<option value="">প্রথমে ব্যাংক তথ্য যুক্ত করুন</option>';
                }
            } else {
                window.showToast("আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে!", false);
                setTimeout(() => { signOut(auth); }, 1500);
            }
        });
        document.getElementById('global-loader').classList.remove('active');
        window.switchAppView('home-view');
    } else {
        activeUserId = null;
        document.getElementById('global-loader').classList.remove('active');
        window.switchAppView('login-view');
    }
});

window.onload = () => { window.generateCaptcha(); };
