/* AUTO-EXTRACTED from 02-dashboard prototype — do not hand-edit.
   Regenerate with tools/extract-shell.py if the prototype changes. */

export const SIDEBAR_HTML = `
  <aside class="sidebar" id="sidebar" aria-label="Primary navigation">
    <div class="sidebar__brand">
      <span class="logo" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8.5" height="8.5" rx="2" stroke="#fff" stroke-width="1.8"/>
          <rect x="12.5" y="12.5" width="8.5" height="8.5" rx="2" stroke="#fff" stroke-width="1.8"/>
          <path d="M11.5 7.5h1.5a3 3 0 0 1 3 3v1.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </span>
      <span>
        <span class="sidebar__name">Bind Build ERP</span><br>
        <span class="sidebar__sub">STUDIO&nbsp;BIND</span>
      </span>
    </div>

    <nav class="sidebar__nav">
      <div class="nav-group">
        <div class="nav-group__label">Overview</div>
        <a class="nav-item" href="/dashboard.html" data-route="dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
          Dashboard
        </a>
        <a class="nav-item" href="/analytics.html" data-route="analytics" data-nav="Analytics">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>
          Analytics
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">Sales</div>
        <a class="nav-item" href="/crm.html" data-route="crm" data-nav="CRM">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>
          CRM · Leads
          <span class="nav-item__count" hidden></span>
        </a>
        <a class="nav-item" href="/client.html" data-route="clients" data-nav="Clients">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
          Clients
        </a>
        <a class="nav-item" href="/sales.html" data-route="sales" data-nav="Sales">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9"/><path d="M9 14.5 21.5 2M15 2h6.5v6.5"/></svg>
          Sales &amp; Proposals
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">Delivery</div>
        <a class="nav-item" href="/projects.html" data-route="projects" data-nav="Projects">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/></svg>
          Projects
          <span class="nav-item__count" hidden></span>
        </a>
        <a class="nav-item" href="/design.html" data-route="design" data-nav="Design">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19 5 12l7-7 7 7z"/><path d="M5 12h14"/></svg>
          Design Studio
        </a>
        <a class="nav-item" href="/progress.html" data-route="construction" data-nav="Construction">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M4 20V9l8-6 8 6v11"/><path d="M9 20v-6h6v6"/></svg>
          Construction
        </a>
        <a class="nav-item" href="/dsr.html" data-route="site-visits" data-nav="Site Visits">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Site Visits
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">Supply</div>
        <a class="nav-item" href="/procurement.html" data-route="procurement" data-nav="Procurement">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l2.6 12.6a2 2 0 0 0 2 1.4h8.8a2 2 0 0 0 2-1.6L22 7H6"/></svg>
          Procurement
          <span class="nav-item__count" hidden></span>
        </a>
        <a class="nav-item" href="/inventory.html" data-route="inventory" data-nav="Inventory">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3.3 8.7 8.7 4.8 8.7-4.8M12 22V13.5"/></svg>
          Inventory
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">Money</div>
        <a class="nav-item" href="/finance.html" data-route="finance" data-nav="Finance">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          Finance
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">People</div>
        <a class="nav-item" href="/hr.html" data-route="hr" data-nav="HR">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          HR
        </a>
        <a class="nav-item" href="/people.html" data-route="people" data-nav="People &amp; Performance">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.3 12C19 16.4 12 21 12 21z"/></svg>
          People &amp; Performance
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">Workspace</div>
        <a class="nav-item" href="/documents.html" data-route="documents" data-nav="Documents">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          Documents
        </a>
        <a class="nav-item" href="/meetings.html" data-route="meetings" data-nav="Meetings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>
          Calendar &amp; Meetings
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">External</div>
        <a class="nav-item" href="/client-portal.html" data-route="client-portal" data-nav="Client Portal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>
          Client Portal
        </a>
        <a class="nav-item" href="/vendor-portal.html" data-route="vendor-portal" data-nav="Vendor Portal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M14 8h4l4 4v5h-3"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></svg>
          Vendor Portal
        </a>
      </div>

      <div class="nav-group">
        <div class="nav-group__label">System</div>
        <a class="nav-item" href="/backup.html" data-route="backup" data-nav="Backup & Operations">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></svg>
          Backup &amp; Operations
        </a>
        <a class="nav-item" href="/settings.html" data-route="settings" data-nav="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.2l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>
          Settings
        </a>
      </div>
    </nav>

    <div class="sidebar__foot">
      <div class="storage">
        <div class="storage__row"><span>Document storage</span><b>68%</b></div>
        <div class="meter"><div class="meter__fill" id="storageFill" data-width="68%"></div></div>
      </div>
    </div>
  </aside>
`;

export const TOPBAR_HTML = `
    <header class="topbar">
      <button class="icon-btn hamburger" id="navToggle" aria-label="Open navigation" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>

      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="#">Home</a><span class="sep">/</span><span class="here">Dashboard</span>
      </nav>

      <!-- Search -->
      <div class="search" id="search">
        <svg class="search__ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
        <input class="search__input" id="searchInput" type="search" placeholder="Search projects, clients, invoices…"
               role="combobox" aria-expanded="false" aria-controls="searchPop" autocomplete="off" />
        <span class="search__kbd">⌘K</span>
        <div class="search__pop" id="searchPop" role="listbox"></div>
      </div>

      <!-- + New quick actions -->
      <div class="newmenu">
        <button class="btn-new" id="newBtn" aria-haspopup="menu" aria-expanded="false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-new__label">New</span>
        </button>
        <div class="menu" id="newMenu" role="menu">
          <button class="menu__item" role="menuitem" data-new="Lead"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>New lead</button>
          <button class="menu__item" role="menuitem" data-new="Project"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>New project</button>
          <button class="menu__item" role="menuitem" data-new="Invoice"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2 3-2V8z"/><path d="M14 2v6h6"/></svg>New invoice</button>
          <button class="menu__item" role="menuitem" data-new="Task"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>New task</button>
          <div class="menu__rule"></div>
          <button class="menu__item" role="menuitem" data-new="Site visit log"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>Log site visit</button>
        </div>
      </div>

      <!-- Notifications -->
      <button class="icon-btn" id="notifBtn" aria-label="Notifications, 3 unread">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <span class="icon-btn__dot" id="notifCount" hidden></span>
      </button>

      <!-- Theme -->
      <button class="icon-btn" id="themeToggle" aria-label="Toggle colour theme">
        <svg class="ico-moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="ico-sun" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>

      <!-- Profile -->
      <div class="profile">
        <button class="profile__btn" id="profileBtn" aria-haspopup="menu" aria-expanded="false">
          <span class="avatar" id="avatarInitials">··</span>
          <span class="profile__meta">
            <span class="profile__name" id="profileName">…</span><br>
            <span class="profile__role" id="profileRole">…</span>
          </span>
        </button>
        <div class="menu" id="profileMenu" role="menu">
          <div class="menu__head"><b id="menuName">…</b><span id="menuEmail">…</span></div>
          <button class="menu__item" role="menuitem" data-nav="My profile"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>My profile</button>
          <button class="menu__item" role="menuitem" data-nav="Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>Settings</button>
          <div class="menu__rule"></div>
          <button class="menu__item" role="menuitem" id="signOutBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>Sign out</button>
        </div>
      </div>
    </header>
`;
