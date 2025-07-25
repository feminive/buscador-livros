// Initialize module
Hooks.once('init', () => {
  console.log('Strapi Search | Initializing');
});

// Add controls when ready
Hooks.once('ready', () => {
  console.log('Strapi Search | Ready');
  
  // Register the /buscar chat command properly
  if (game.chatCommands) {
    game.chatCommands.register({
      name: "buscar",
      module: "strapi-search",
      description: "Abrir busca de conteúdo Strapi",
      icon: '<i class="fas fa-search"></i>',
      callback: () => {
        openSearchDialog();
      }
    });
  }
  
  // Add button to scene controls
  Hooks.on('getSceneControlButtons', (controls) => {
    controls.push({
      name: 'strapi-search',
      title: 'Strapi Search',
      icon: 'fas fa-search',
      layer: 'TokenLayer',
      tools: [
        {
          name: 'search',
          title: 'Search Strapi',
          icon: 'fas fa-search',
          onClick: () => openSearchDialog(),
          button: true
        }
      ]
    });
  });

  // Fallback method using chat message hook for /buscar command
  Hooks.on('chatMessage', (chatLog, message, chatData) => {
    if (message.trim().toLowerCase() === '/buscar') {
      openSearchDialog();
      return false; // Prevent the message from being sent to chat
    }
    return true; // Allow other messages to proceed normally
  });

  // Listen for socket events
  game.socket.on('module.strapi-search', (data) => {
    if (data.type === 'showDialog') {
      openSearchDialog();
    }
  });
});

// Search dialog with autocomplete and auto-listing
function openSearchDialog() {
  new Dialog({
    title: 'Strapi Content Search',
    content: `
      <form class="strapi-search-form">
        <div class="search-header">
          <div class="content-types">
            <label class="type-toggle active" data-type="advantages">
              <input type="checkbox" value="advantages" checked>
              <span>Vantagens</span>
            </label>
            <label class="type-toggle" data-type="disadvantages">
              <input type="checkbox" value="disadvantages">
              <span>Desvantagens</span>
            </label>
            <label class="type-toggle" data-type="spells">
              <input type="checkbox" value="spells">
              <span>Magias</span>
            </label>
            <label class="type-toggle" data-type="skills">
              <input type="checkbox" value="skills">
              <span>Perícias</span>
            </label>
          </div>
          
          <div class="colleges-filter" id="colleges-filter" style="display: none;">
            <div class="filter-title">Filtrar por Escola de Magia:</div>
            <div class="college-toggles-container" id="college-toggles">
              <div class="loading-colleges">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Carregando escolas...</span>
              </div>
            </div>
          </div>
          
          <div class="search-input-container">
            <input type="text" id="search-term" placeholder="Buscar conteúdo...">
            <i class="fas fa-search search-icon"></i>
          </div>
        </div>
        
        <div id="search-results" class="results-container">
          <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Carregando conteúdo...</span>
          </div>
        </div>
      </form>
    `,
    buttons: {
      close: {
        icon: "fas fa-times",
        label: 'Fechar'
      }
    },
    default: 'close',
    render: (html) => {
      const searchInput = html.find('#search-term');
      const typeToggles = html.find('.type-toggle');
      const resultsDiv = html.find('#search-results');
      const collegesFilter = html.find('#colleges-filter');
      const collegeTogglesContainer = html.find('#college-toggles');
      
      let searchTimeout;
      let currentResults = [];
      let colleges = [];
      
      // Function to get selected types
      const getSelectedTypes = () => {
        const selected = [];
        typeToggles.each(function() {
          if ($(this).find('input').prop('checked')) {
            selected.push($(this).find('input').val());
          }
        });
        return selected;
      };
      
      // Function to get selected colleges
      const getSelectedColleges = () => {
        const selected = [];
        collegeTogglesContainer.find('.college-toggle input:checked').each(function() {
          selected.push($(this).val());
        });
        return selected;
      };
      
      // Function to load colleges from API
      const loadColleges = async () => {
        try {
          const response = await fetch('https://api.rolandodados.com.br/api/colleges?populate=*');
          const data = await response.json();
          colleges = data.data || [];
          
          if (colleges.length > 0) {
            let collegeTogglesHtml = '';
            colleges.forEach(college => {
              collegeTogglesHtml += `
                <label class="type-toggle college-toggle" data-college="${college.id}">
                  <input type="checkbox" value="${college.id}">
                  <span>${college.attributes.name}</span>
                </label>
              `;
            });
            collegeTogglesContainer.html(collegeTogglesHtml);
            
            // Add event listeners to college toggles
            collegeTogglesContainer.find('.college-toggle').on('click', function(e) {
              e.preventDefault();
              const checkbox = $(this).find('input');
              const isChecked = checkbox.prop('checked');
              
              checkbox.prop('checked', !isChecked);
              $(this).toggleClass('active', !isChecked);
              
              clearTimeout(searchTimeout);
              searchTimeout = setTimeout(performSearch, 100);
            });
          } else {
            collegeTogglesContainer.html('<span class="no-colleges">Nenhuma escola encontrada</span>');
          }
        } catch (error) {
          console.error('Error loading colleges:', error);
          collegeTogglesContainer.html('<span class="error-colleges">Erro ao carregar escolas</span>');
        }
      };
      
      // Function to show/hide colleges filter based on selected types
      const updateCollegesFilterVisibility = () => {
        const selectedTypes = getSelectedTypes();
        const showCollegesFilter = selectedTypes.includes('spells');
        
        if (showCollegesFilter) {
          collegesFilter.show();
        } else {
          collegesFilter.hide();
          // Clear college selections when hiding
          collegeTogglesContainer.find('.college-toggle').removeClass('active');
          collegeTogglesContainer.find('.college-toggle input').prop('checked', false);
        }
      };
      
      // Function to perform search
      const performSearch = async () => {
        const term = searchInput.val().trim();
        const selectedTypes = getSelectedTypes();
        const selectedColleges = getSelectedColleges();
        
        if (selectedTypes.length === 0) {
          resultsDiv.html(`
            <div class="empty-state">
              <i class="fas fa-info-circle"></i>
              <span>Selecione pelo menos um tipo de conteúdo</span>
            </div>
          `);
          return;
        }
        
        try {
          resultsDiv.html(`
            <div class="loading-state">
              <i class="fas fa-spinner fa-spin"></i>
              <span>Buscando...</span>
            </div>
          `);
          
          // Fetch data from all selected types
          const promises = selectedTypes.map(async (type) => {
            let url;
            let baseUrl = `https://api.rolandodados.com.br/api/${type}?populate=*`;
            
            // Build filters array
            const filters = [];
            
            // Add name filter if search term exists
            if (term.length >= 2) {
              filters.push(`filters[name][$containsi]=${encodeURIComponent(term)}`);
            }
            
            // Add college filter for spells if colleges are selected
            if (type === 'spells' && selectedColleges.length > 0) {
              const collegeIds = selectedColleges.join(',');
              filters.push(`filters[colleges][id][$in]=${collegeIds}`);
            }
            
            // Construct final URL
            if (filters.length > 0) {
              url = `${baseUrl}&${filters.join('&')}`;
            } else {
              url = baseUrl;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            return { type, data: data.data || [] };
          });
          
          const results = await Promise.all(promises);
          currentResults = results.flatMap(result => 
            result.data.map(item => ({ ...item, contentType: result.type }))
          );
          
          if (currentResults.length > 0) {
            displayResults(currentResults, resultsDiv);
          } else {
            resultsDiv.html(`
              <div class="empty-state">
                <i class="fas fa-search"></i>
                <span>Nenhum resultado encontrado</span>
              </div>
            `);
          }
        } catch (error) {
          console.error('Search error:', error);
          resultsDiv.html(`
            <div class="error-state">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Erro de conexão. Verifique se a API está disponível.</span>
            </div>
          `);
        }
      };
      
      // Event listeners
      searchInput.on('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
      });
      
      typeToggles.on('click', function(e) {
        e.preventDefault();
        const checkbox = $(this).find('input');
        const isChecked = checkbox.prop('checked');
        
        checkbox.prop('checked', !isChecked);
        $(this).toggleClass('active', !isChecked);
        
        // Update colleges filter visibility
        updateCollegesFilterVisibility();
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 100);
      });
      
      // Initialize
      loadColleges().then(() => {
        updateCollegesFilterVisibility();
        performSearch();
      });
    }
  }, {
    classes: ["strapi-search-dialog"],
    width: 800,
    height: 600,
    resizable: true
  }).render(true);
}

// Display results
function displayResults(results, container) {
  let content = '<div class="results-grid">';
  
  results.forEach((item, index) => {
    const attrs = item.attributes;
    const contentType = item.contentType;
    
    const typeLabels = {
      advantages: 'Vantagem',
      disadvantages: 'Desvantagem', 
      spells: 'Magia',
      skills: 'Perícia'
    };
    
    const typeLabel = typeLabels[contentType] || contentType;
    
    // Get colleges for spells
    let collegesInfo = '';
    if (contentType === 'spells' && attrs.colleges && attrs.colleges.data && attrs.colleges.data.length > 0) {
      const collegeNames = attrs.colleges.data.map(college => college.attributes.name).join(', ');
      collegesInfo = `<div class="info-item"><span class="label">Escolas:</span> <span class="value">${collegeNames}</span></div>`;
    }
    
    content += `
      <div class="result-card" data-index="${index}">
        <div class="card-header">
          <div class="card-title-custom">${attrs.name}</div>
          <span class="type-badge type-${contentType}">${typeLabel}</span>
        </div>
        <div class="card-content">
          ${attrs.cost && attrs.cost !== 'N/A' ? `<div class="info-item"><span class="label">Custo:</span> <span class="value">${attrs.cost}</span></div>` : ''}
          ${attrs.dif ? `<div class="info-item"><span class="label">Dificuldade:</span> <span class="value">${attrs.dif}</span></div>` : ''}
          ${attrs.class ? `<div class="info-item"><span class="label">Classe:</span> <span class="value">${attrs.class}</span></div>` : ''}
          ${collegesInfo}
        </div>
      </div>
    `;
  });
  
  content += '</div>';
  container.html(content);
  
  // Add click handlers
  container.find('.result-card').on('click', function() {
    const index = $(this).data('index');
    showDetailedResult(results[index]);
  });
}

// Show detailed result
function showDetailedResult(item) {
  const attrs = item.attributes;
  
  // Get colleges for spells
  let collegesMetaItem = '';
  if (item.contentType === 'spells' && attrs.colleges && attrs.colleges.data && attrs.colleges.data.length > 0) {
    const collegeNames = attrs.colleges.data.map(college => college.attributes.name).join(', ');
    collegesMetaItem = `<span class="meta-item">Escolas: ${collegeNames}</span>`;
  }
  
  let content = `
    <div class="detail-view">
      <div class="detail-header">
        <div class="detail-title-custom">${attrs.name}</div>
        <div class="detail-meta">
          ${attrs.cost && attrs.cost !== 'N/A' ? `<span class="meta-item">Custo: ${attrs.cost}</span>` : ''}
          ${attrs.class ? `<span class="meta-item">Classe: ${attrs.class}</span>` : ''}
          ${attrs.duration ? `<span class="meta-item">Duração: ${attrs.duration}</span>` : ''}
          ${attrs.time ? `<span class="meta-item">Tempo: ${attrs.time}</span>` : ''}
          ${attrs.dif ? `<span class="meta-item">Dificuldade: ${attrs.dif}</span>` : ''}
          ${collegesMetaItem}
        </div>
      </div>
      
      ${attrs.req ? `<div class="detail-section"><strong>Requisitos:</strong> ${attrs.req}</div>` : ''}
      ${attrs.pre ? `<div class="detail-section"><strong>Pré-requisito:</strong> ${attrs.pre}</div>` : ''}
      
      <div class="detail-section">
        <div class="section-title-custom">Descrição</div>
        <div class="description-content">
          ${attrs.description || 'Nenhuma descrição disponível'}
        </div>
      </div>
      
      ${attrs.mod ? `
        <div class="detail-section">
          <div class="section-title-custom">Modificadores</div>
          <div class="modifier-content">
            ${attrs.mod}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  new Dialog({
    title: attrs.name,
    content: content,
    buttons: {
      close: {
        icon: "fas fa-times",
        label: 'Fechar'
      }
    }
  }, {
    classes: ["strapi-detail-dialog"],
    width: 700,
    height: 500,
    resizable: true
  }).render(true);
}