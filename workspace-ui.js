// workspace-ui.js
(function(){
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // Mobile sidebar
  const sidebar = $("#wsSidebar");
  const backdrop = $("#wsBackdrop");
  const btnMenu = $("#btnMenu");
  if(btnMenu){
    btnMenu.addEventListener("click", ()=>{
      sidebar.classList.add("open");
      backdrop.classList.add("show");
    });
  }
  if(backdrop){
    backdrop.addEventListener("click", ()=>{
      sidebar.classList.remove("open");
      backdrop.classList.remove("show");
    });
  }

  // Menus
  document.addEventListener("click", (e)=>{
    const kebab = e.target.closest("[data-kebab]");
    const menu  = e.target.closest(".menu");
    // close all if click outside
    if(!kebab && !menu){
      $$(".menu.show").forEach(m=>m.classList.remove("show"));
      return;
    }
    if(kebab){
      const card = kebab.closest(".board");
      const m = $(".menu", card);
      // close others
      $$(".menu.show").forEach(x=>{ if(x!==m) x.classList.remove("show"); });
      m.classList.toggle("show");
    }
  });

  // Toast
  const toast = $("#toast");
  function showToast(t){
    if(!toast) return;
    toast.textContent = t;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"), 1600);
  }

  // Modal helpers
  function openModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.classList.add("show");
    // focus first input
    const first = $("input,textarea,select", m);
    if(first) setTimeout(()=>first.focus(), 50);
  }
  function closeModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.classList.remove("show");
  }
  window.__wsOpenModal = openModal;
  window.__wsCloseModal = closeModal;

  // Modal close buttons & ESC
  $$(".modal").forEach(m=>{
    m.addEventListener("click", (e)=>{
      if(e.target === m) m.classList.remove("show");
    });
    const x = $(".icon-x", m);
    if(x) x.addEventListener("click", ()=>m.classList.remove("show"));
  });
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){
      $$(".modal.show").forEach(m=>m.classList.remove("show"));
      $$(".menu.show").forEach(m=>m.classList.remove("show"));
    }
  });

  // Builder logic (cards names)
  function setupBuilder(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) return;

    const input = modal.querySelector("[data-card-input]");
    const addBtn = modal.querySelector("[data-card-add]");
    const list = modal.querySelector("[data-cards-list]");
    const hidden = modal.querySelector("[data-cards-hidden]");

    const state = { cards: [] };

    function sync(){
      list.innerHTML = "";
      state.cards.forEach((name, idx)=>{
        const pill = document.createElement("div");
        pill.className = "pill";
        pill.innerHTML = `<span>${escapeHtml(name)}</span><span class="x" title="حذف" data-x="${idx}"><i class="fa-solid fa-xmark"></i></span>`;
        list.appendChild(pill);
      });
      hidden.value = state.cards.join(" | ");
    }

    function add(){
      const v = (input.value || "").trim();
      if(!v) return;
      state.cards.push(v);
      input.value = "";
      sync();
    }

    if(addBtn) addBtn.addEventListener("click", add);
    if(input) input.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        add();
      }
    });

    list.addEventListener("click", (e)=>{
      const x = e.target.closest("[data-x]");
      if(!x) return;
      const idx = Number(x.getAttribute("data-x"));
      if(Number.isNaN(idx)) return;
      state.cards.splice(idx,1);
      sync();
    });

    // expose reset for each open
    modal.__resetBuilder = function(cards){
      state.cards = Array.isArray(cards) ? cards.slice() : [];
      sync();
      if(input) input.value = "";
    };

    // init
    sync();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  setupBuilder("agendaModal");
  setupBuilder("campaignModal");

  // Demo data + CRUD (Front-end only)
  const agendasWrap = $("#agendasWrap");
  const campaignsWrap = $("#campaignsWrap");
  const emptyAg = $("#emptyAgendas");
  const emptyCp = $("#emptyCampaigns");

  const state = {
    agendas: [
      { id:"ag1", name:"أجندة يناير", cards:["تصوير","مونتاج","مراجعة","نشر"], updated:"اليوم" }
    ],
    campaigns: [
      { id:"cp1", name:"حملة عروض الربع الأول", desc:"خصومات + محتوى ريلز + صور", start:"2026-01-10", end:"2026-02-10", cards:["تجهيز","تصوير","مونتاج","اعتماد","نشر"], updated:"أمس" }
    ]
  };

  function render(){
    // agendas
    agendasWrap.innerHTML = "";
    if(state.agendas.length === 0){
      emptyAg.classList.remove("hide");
    }else{
      emptyAg.classList.add("hide");
      state.agendas.forEach(a=>{
        agendasWrap.appendChild(boardCard("agenda", a));
      });
    }
    // campaigns
    campaignsWrap.innerHTML = "";
    if(state.campaigns.length === 0){
      emptyCp.classList.remove("hide");
    }else{
      emptyCp.classList.add("hide");
      state.campaigns.forEach(c=>{
        campaignsWrap.appendChild(boardCard("campaign", c));
      });
    }
  }

  function boardCard(type, obj){
    const el = document.createElement("div");
    el.className = "board";
    const title = escapeHtml(obj.name || "");
    const cards = (obj.cards || []).slice(0,4);
    const more = (obj.cards || []).length - cards.length;

    const meta = type === "agenda"
      ? `آخر تحديث: ${escapeHtml(obj.updated||"—")} • ${obj.cards?.length||0} كروت`
      : `من ${escapeHtml(obj.start||"—")} إلى ${escapeHtml(obj.end||"—")} • ${obj.cards?.length||0} كروت`;

    const desc = type === "campaign" ? (obj.desc||"") : "";

    el.innerHTML = `
      <div class="top">
        <div>
          <div class="title">${title}</div>
          <div class="meta">${meta}</div>
          ${desc ? `<div class="meta" style="margin-top:6px">${escapeHtml(desc)}</div>` : ``}
        </div>
        <button class="kebab" type="button" data-kebab aria-label="خيارات">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>

        <div class="menu" role="menu">
          <button type="button" data-open="${obj.id}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>فتح</span>
          </button>
          <button type="button" data-edit="${obj.id}">
            <i class="fa-solid fa-pen"></i>
            <span>تعديل</span>
          </button>
          <button type="button" class="danger" data-del="${obj.id}">
            <i class="fa-solid fa-trash"></i>
            <span>حذف</span>
          </button>
        </div>
      </div>

      <div class="chips">
        ${(cards).map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join("")}
        ${more>0 ? `<span class="chip">+${more}</span>` : ``}
      </div>
    `;

    // actions
    el.addEventListener("click", (e)=>{
      const open = e.target.closest("[data-open]");
      const edit = e.target.closest("[data-edit]");
      const del  = e.target.closest("[data-del]");
      if(open){
        e.preventDefault();
        showToast(type==="agenda" ? "فتح الأجندة (واجهة البورد هتتعمل في صفحة التاسكات)" : "فتح الحملة (واجهة البورد هتتعمل في صفحة التاسكات)");
        return;
      }
      if(edit){
        e.preventDefault();
        if(type==="agenda"){
          openAgendaModal(obj);
        }else{
          openCampaignModal(obj);
        }
        return;
      }
      if(del){
        e.preventDefault();
        if(confirm("متأكد من الحذف؟")){
          if(type==="agenda"){
            state.agendas = state.agendas.filter(x=>x.id!==obj.id);
          }else{
            state.campaigns = state.campaigns.filter(x=>x.id!==obj.id);
          }
          render();
          showToast("تم الحذف");
        }
        return;
      }
    });

    return el;
  }

  // Open/create
  const btnNewAgenda = $("#btnNewAgenda");
  const btnNewCampaign = $("#btnNewCampaign");
  if(btnNewAgenda) btnNewAgenda.addEventListener("click", ()=>openAgendaModal(null));
  if(btnNewCampaign) btnNewCampaign.addEventListener("click", ()=>openCampaignModal(null));

  function openAgendaModal(obj){
    const modal = document.getElementById("agendaModal");
    modal.dataset.mode = obj ? "edit" : "create";
    modal.dataset.id = obj ? obj.id : "";
    $("#agendaName").value = obj ? (obj.name||"") : "";
    modal.__resetBuilder(obj ? (obj.cards||[]) : []);
    $("#agendaHelp").textContent = obj ? "تعديل الأجندة وتحديث الكروت" : "اكتب أسماء الكروت (Columns) اللي هتشتغل عليها داخل الأجندة";
    $("#agendaSave").textContent = obj ? "حفظ التعديل" : "إنشاء الأجندة";
    openModal("agendaModal");
  }

  function openCampaignModal(obj){
    const modal = document.getElementById("campaignModal");
    modal.dataset.mode = obj ? "edit" : "create";
    modal.dataset.id = obj ? obj.id : "";
    $("#campName").value = obj ? (obj.name||"") : "";
    $("#campDesc").value = obj ? (obj.desc||"") : "";
    $("#campStart").value = obj ? (obj.start||"") : "";
    $("#campEnd").value = obj ? (obj.end||"") : "";
    modal.__resetBuilder(obj ? (obj.cards||[]) : []);
    $("#campHelp").textContent = obj ? "تعديل الحملة والكروت الخاصة بها" : "حدد فترة الحملة، ثم أسماء الكروت اللي هتمشي عليها المهام";
    $("#campSave").textContent = obj ? "حفظ التعديل" : "إنشاء الحملة";
    openModal("campaignModal");
  }

  // Save handlers
  $("#agendaSave").addEventListener("click", ()=>{
    const modal = document.getElementById("agendaModal");
    const name = ($("#agendaName").value||"").trim();
    const cards = ($("#agendaCards").value||"").split("|").map(s=>s.trim()).filter(Boolean);
    if(!name){ showToast("اكتب اسم الأجندة"); return; }
    if(cards.length===0){ showToast("أضف كارت واحد على الأقل"); return; }

    if(modal.dataset.mode==="edit"){
      const id = modal.dataset.id;
      const it = state.agendas.find(x=>x.id===id);
      if(it){
        it.name = name;
        it.cards = cards;
        it.updated = "الآن";
      }
      showToast("تم تعديل الأجندة");
    }else{
      const id = "ag"+Math.random().toString(16).slice(2,8);
      state.agendas.unshift({id, name, cards, updated:"الآن"});
      showToast("تم إنشاء الأجندة");
    }
    closeModal("agendaModal");
    render();
  });

  $("#campSave").addEventListener("click", ()=>{
    const modal = document.getElementById("campaignModal");
    const name = ($("#campName").value||"").trim();
    const desc = ($("#campDesc").value||"").trim();
    const start= $("#campStart").value||"";
    const end  = $("#campEnd").value||"";
    const cards = ($("#campCards").value||"").split("|").map(s=>s.trim()).filter(Boolean);

    if(!name){ showToast("اكتب اسم الحملة"); return; }
    if(!start || !end){ showToast("حدد تاريخ البداية والنهاية"); return; }
    if(cards.length===0){ showToast("أضف كارت واحد على الأقل"); return; }

    if(modal.dataset.mode==="edit"){
      const id = modal.dataset.id;
      const it = state.campaigns.find(x=>x.id===id);
      if(it){
        it.name=name; it.desc=desc; it.start=start; it.end=end; it.cards=cards; it.updated="الآن";
      }
      showToast("تم تعديل الحملة");
    }else{
      const id = "cp"+Math.random().toString(16).slice(2,8);
      state.campaigns.unshift({id, name, desc, start, end, cards, updated:"الآن"});
      showToast("تم إنشاء الحملة");
    }

    closeModal("campaignModal");
    render();
  });

  // initial
  render();
})();