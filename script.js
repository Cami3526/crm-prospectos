const SUPABASE_URL = 'https://aypexczsibphswvvyhwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGV4Y3pzaWJwaHN3d3Z5aHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODQ3MzIsImV4cCI6MjA5NTU2MDczMn0.-Dyvg3BJfIz8P49qE5EW9pilfToCcE2NjHu4KML3yeM';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let prospectosList = [];
let activeFilter = 'Todos';

document.addEventListener('DOMContentLoaded', () => {
  loadProspects();
  setupEvents();
});

async function loadProspects() {
  if (!window.supabaseClient) return;
  try {
    const { data, error } = await window.supabaseClient
      .from('prospectos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    prospectosList = data || [];
    renderProspects();
    updateAlerts();
  } catch (err) {
    console.error('Error al cargar prospectos:', err.message);
  }
}

function renderProspects() {
  const prospectsGrid = document.getElementById('prospectsGrid');
  const searchInput = document.getElementById('searchInput');
  if (!prospectsGrid) return;

  const query = searchInput ? searchInput.value.toLowerCase() : '';
  
  const filtered = prospectosList.filter(p => {
    const matchesFilter = activeFilter === 'Todos' || p.etapa === activeFilter;
    const matchesSearch = (p.nombre && p.nombre.toLowerCase().includes(query)) || 
                          (p.ciudad && p.ciudad.toLowerCase().includes(query)) ||
                          (p.telefono && p.telefono.includes(query));
    return matchesFilter && matchesSearch;
  });

  prospectsGrid.innerHTML = '';

  if (filtered.length === 0) {
    prospectsGrid.innerHTML = '<p class="glass-card" style="grid-column: 1/-1; text-align:center;">No hay prospectos para mostrar.</p>';
    return;
  }

  filtered.forEach(p => {
    const statusClass = getStatusClass(p.fecha_seguimiento);
    const card = document.createElement('div');
    card.className = `glass-card prospect-card ${statusClass}`;
    
    card.innerHTML = `
      <div class="card-header">
        <h3>${escapeHtml(p.nombre)}</h3>
        <span class="tag tag-${(p.prioridad || 'media').toLowerCase()}">${p.prioridad || 'Media'}</span>
      </div>
      <div class="card-details">
        <p>📱 ${escapeHtml(p.telefono || 'Sin teléfono')} | 📍 ${escapeHtml(p.ciudad || 'N/A')}</p>
        <p>🎯 Vertical: <strong>${escapeHtml(p.vertical || 'N/A')}</strong></p>
        <p>📌 Etapa: <strong>${escapeHtml(p.etapa || 'N/A')}</strong></p>
        <p>⏰ Seguimiento: ${p.fecha_seguimiento ? new Date(p.fecha_seguimiento).toLocaleString('es-CO') : 'Sin fecha'}</p>
      </div>
      ${p.notas ? `<div class="card-notes">"${escapeHtml(p.notas)}"</div>` : ''}
      <div class="card-actions">
        <button class="action-btn" onclick="editProspect('${p.id}')">✏️ Editar</button>
        <button class="action-btn" onclick="openWhatsApp('${p.telefono}')">💬 WhatsApp</button>
        <button class="action-btn" onclick="deleteProspect('${p.id}')" style="color: #d64045;">🗑️ Eliminar</button>
      </div>
    `;
    prospectsGrid.appendChild(card);
  });
}

function setupEvents() {
  const prospectForm = document.getElementById('prospectForm');
  const searchInput = document.getElementById('searchInput');

  if (prospectForm) {
    prospectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('prospectId').value;
      const payload = {
        nombre: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value,
        ciudad: document.getElementById('ciudad').value,
        canal: document.getElementById('canal').value,
        vertical: document.getElementById('vertical').value,
        etapa: document.getElementById('etapa').value,
        prioridad: document.getElementById('prioridad').value,
        fecha_seguimiento: document.getElementById('fechaSeguimiento').value || null,
        notas: document.getElementById('notas').value
      };

      try {
        if (id) {
          const { error } = await window.supabaseClient.from('prospectos').update(payload).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await window.supabaseClient.from('prospectos').insert([payload]);
          if (error) throw error;
        }
        
        resetForm();
        await loadProspects();
      } catch (err) {
        alert('Error al guardar en Supabase: ' + err.message);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderProspects);
  }
  
  const filterTabs = document.getElementById('filterTabs');
  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab')) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        activeFilter = e.target.dataset.filter;
        renderProspects();
      }
    });
  }

  const btnCancel = document.getElementById('btnCancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', resetForm);
  }
}

function getStatusClass(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffHours = (date - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'urgent';
  if (diffHours <= 24) return 'today';
  if (diffHours <= 48) return 'next';
  return '';
}

function updateAlerts() {
  const alertCount = document.getElementById('alertCount');
  const alertDetail = document.getElementById('alertDetail');
  if (!alertCount || !alertDetail) return;

  const now = new Date();
  const urgentes = prospectosList.filter(p => p.fecha_seguimiento && new Date(p.fecha_seguimiento) < now).length;
  const hoy = prospectosList.filter(p => {
    if (!p.fecha_seguimiento) return false;
    const d = new Date(p.fecha_seguimiento);
    return d >= now && d.toDateString() === now.toDateString();
  }).length;

  alertCount.textContent = `${urgentes} Vencidos | ${hoy} Para Hoy`;
  alertDetail.textContent = urgentes > 0 ? '¡Requiere atención inmediata!' : 'Al día con los seguimientos';
}

window.editProspect = (id) => {
  const p = prospectosList.find(item => item.id === id);
  if (!p) return;

  document.getElementById('prospectId').value = p.id;
  document.getElementById('nombre').value = p.nombre;
  document.getElementById('telefono').value = p.telefono || '';
  document.getElementById('ciudad').value = p.ciudad || '';
  document.getElementById('canal').value = p.canal || 'WhatsApp';
  document.getElementById('vertical').value = p.vertical || 'Negocio Global';
  document.getElementById('etapa').value = p.etapa;
  document.getElementById('prioridad').value = p.prioridad;
  document.getElementById('fechaSeguimiento').value = p.fecha_seguimiento ? p.fecha_seguimiento.slice(0, 16) : '';
  document.getElementById('notas').value = p.notas || '';

  document.getElementById('formTitle').textContent = 'Editar Prospecto';
  document.getElementById('btnSave').textContent = 'Actualizar';
  document.getElementById('btnCancel').style.display = 'inline-block';
};

window.deleteProspect = async (id) => {
  if (!confirm('¿Seguro que deseas eliminar este prospecto?')) return;
  try {
    const { error } = await window.supabaseClient.from('prospectos').delete().eq('id', id);
    if (error) throw error;
    await loadProspects();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
};

window.openWhatsApp = (phone) => {
  if (!phone) return alert('No hay número de teléfono registrado.');
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
};

function resetForm() {
  const prospectForm = document.getElementById('prospectForm');
  if (prospectForm) prospectForm.reset();
  document.getElementById('prospectId').value = '';
  document.getElementById('formTitle').textContent = 'Nuevo Prospecto';
  document.getElementById('btnSave').textContent = 'Guardar Prospecto';
  document.getElementById('btnCancel').style.display = 'none';
}

function escapeHtml(str) {
  return str ? String(str).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])) : '';
}