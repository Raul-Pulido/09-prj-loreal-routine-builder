/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

// Hide products grid at start
productsContainer.classList.add("hidden");
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Store selected products in an array, loaded from localStorage if available
let selectedProducts = [];
try {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    selectedProducts = JSON.parse(saved);
  }
} catch (e) {
  selectedProducts = [];
}

// Reference to the Generate Routine button
const generateRoutineBtn = document.getElementById("generateRoutine");
// Helper to call Cloudflare Worker (OpenAI) API and get a routine
async function getRoutineFromOpenAI(selectedProducts) {
  // Prepare a simple message for the API
  const productList = selectedProducts
    .map((p) => `${p.name} (${p.brand})`)
    .join(", ");
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful skincare and beauty advisor. Suggest a personalized routine using only the selected products. Use current, real-world information and include visible links or citations for any facts, products, or recommendations. Keep it simple and beginner-friendly.",
    },
    {
      role: "user",
      content: `Here are my selected products: ${productList}. Please create a step-by-step routine using only these products. Include links or citations for any facts, products, or recommendations you mention.`,
    },
  ];

  // Call Cloudflare Worker endpoint (no API key or Authorization header needed)
  try {
    const response = await fetch("https://loreal.rp39343.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 300,
      }),
    });
    const data = await response.json();
    // Check for valid response
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content;
    } else {
      return "Sorry, I couldn't generate a routine. Please try again.";
    }
  } catch (error) {
    return "Error connecting to OpenAI API.";
  }
}
// Handle Generate Routine button click
generateRoutineBtn.addEventListener("click", async () => {
  // If no products selected, show a message
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML =
      "<div class='placeholder-message'>Please select at least one product to generate a routine.</div>";
    return;
  }

  // Show loading message
  chatWindow.innerHTML =
    "<div class='placeholder-message'>Generating your personalized routine...</div>";

  // Get routine from OpenAI
  const routine = await getRoutineFromOpenAI(selectedProducts);

  // Display the routine in the chat window
  chatWindow.innerHTML = `<div>${routine.replace(/\n/g, "<br>")}</div>`;
});

// Helper to update the selected products list UI
function updateSelectedProductsList() {
  const selectedProductsList = document.getElementById("selectedProductsList");
  // Save to localStorage
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    // Remove Clear All button if present
    const clearBtn = document.getElementById("clearSelectedProducts");
    if (clearBtn) clearBtn.remove();
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="product-card selected-mini" data-product-name="${product.name}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
          </div>
        </div>
      `,
    )
    .join("");

  // Add Clear All button if not present
  if (!document.getElementById("clearSelectedProducts")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearSelectedProducts";
    clearBtn.className = "clear-btn";
    clearBtn.textContent = "Clear All";
    clearBtn.style.margin = "10px 0";
    clearBtn.addEventListener("click", () => {
      selectedProducts = [];
      updateSelectedProductsList();
      // Only refresh the main product grid if a category is selected
      const selectedCategory = categoryFilter.value;
      if (selectedCategory) {
        loadProducts().then((products) => {
          const filteredProducts = products.filter(
            (product) => product.category === selectedCategory,
          );
          displayProducts(filteredProducts);
        });
      }
    });
    selectedProductsList.parentNode.insertBefore(
      clearBtn,
      selectedProductsList.nextSibling,
    );
  }

  // Add click event listeners to remove product when clicked
  const selectedCards = selectedProductsList.querySelectorAll(
    ".product-card.selected-mini",
  );
  selectedCards.forEach((card) => {
    card.addEventListener("click", () => {
      const productName = card.getAttribute("data-product-name");
      const index = selectedProducts.findIndex((p) => p.name === productName);
      if (index !== -1) {
        selectedProducts.splice(index, 1);
        updateSelectedProductsList();
        // Only refresh the main product grid if a category is selected
        const selectedCategory = categoryFilter.value;
        if (selectedCategory) {
          loadProducts().then((products) => {
            const filteredProducts = products.filter(
              (product) => product.category === selectedCategory,
            );
            displayProducts(filteredProducts);
          });
        }
      }
    });
  });
}

// Create HTML for displaying product cards and add click handlers
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      // Check if product is selected
      const isSelected = selectedProducts.some((p) => p.name === product.name);
      return `
        <div class="product-card${isSelected ? " selected" : ""}" data-product-name="${product.name}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="info-btn" aria-label="Show description for ${product.name}" tabindex="0">ℹ️</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Add click event listeners to each product card (select/deselect)
  const productCards = productsContainer.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      // Prevent click if info button was clicked
      if (e.target.classList.contains("info-btn")) return;
      const productName = card.getAttribute("data-product-name");
      const product = products.find((p) => p.name === productName);
      const index = selectedProducts.findIndex((p) => p.name === productName);
      if (index === -1) {
        // Not selected, add to selectedProducts
        selectedProducts.push(product);
      } else {
        // Already selected, remove from selectedProducts
        selectedProducts.splice(index, 1);
      }
      // Update UI
      displayProducts(products);
      updateSelectedProductsList();
    });
  });

  // Add event listeners for info buttons (show description overlay)
  const infoBtns = productsContainer.querySelectorAll(".info-btn");
  infoBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".product-card");
      const productName = card.getAttribute("data-product-name");
      const product = products.find((p) => p.name === productName);
      showProductDescription(product);
    });
  });
}

// Show product description in an accessible overlay
function showProductDescription(product) {
  // Remove any existing overlay
  const oldOverlay = document.getElementById("productDescOverlay");
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "productDescOverlay";
  overlay.className = "product-desc-overlay";
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="desc-modal" role="dialog" aria-modal="true" aria-label="Product Description">
      <button class="close-desc-btn" aria-label="Close description">&times;</button>
      <h2>${product.name}</h2>
      <p><b>Brand:</b> ${product.brand}</p>
      <p>${product.description || "No description available."}</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Focus for accessibility
  overlay.focus();

  // Close on button click
  overlay.querySelector(".close-desc-btn").addEventListener("click", () => {
    overlay.remove();
  });
  // Close on overlay click (outside modal)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  // Close on Escape key
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") overlay.remove();
  });
}

// Product search and filter logic
const productSearch = document.getElementById("productSearch");
let allProducts = [];

// Helper to filter products by category and search
function filterAndDisplayProducts() {
  let filtered = allProducts;
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();
  // Show/hide products grid based on category selection
  if (selectedCategory) {
    productsContainer.classList.remove("hidden");
    filtered = filtered.filter(
      (product) => product.category === selectedCategory,
    );
  } else {
    productsContainer.classList.add("hidden");
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        (product.description &&
          product.description.toLowerCase().includes(searchTerm)) ||
        (product.brand && product.brand.toLowerCase().includes(searchTerm)),
    );
  }
  displayProducts(filtered);
}

// Load all products once and set up listeners
loadProducts().then((products) => {
  allProducts = products;
  filterAndDisplayProducts();
});

categoryFilter.addEventListener("change", filterAndDisplayProducts);
productSearch.addEventListener("input", filterAndDisplayProducts);

// Initial selected products list UI
updateSelectedProductsList();

// Store chat history for follow-up questions
let chatHistory = [];

// Helper to call Cloudflare Worker (OpenAI) API with chat history
async function getCloudflareChatCompletion(messages) {
  // Always add a system prompt to encourage citations and real-world info
  const systemPrompt = {
    role: "system",
    content:
      "You are a helpful skincare and beauty advisor. Use current, real-world information and provide visible links or citations for any facts, products, or recommendations in your responses.",
  };
  // Ensure the system prompt is always the first message
  let chatMessages = messages;
  if (!messages.length || messages[0].role !== "system") {
    chatMessages = [systemPrompt, ...messages];
  } else {
    // Replace existing system prompt with updated one
    chatMessages = [systemPrompt, ...messages.slice(1)];
  }
  try {
    const response = await fetch("https://loreal.rp39343.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: chatMessages,
        max_tokens: 300,
      }),
    });
    const data = await response.json();
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content;
    } else {
      return "Sorry, I couldn't generate a response. Please try again.";
    }
  } catch (error) {
    return "Error connecting to OpenAI API.";
  }
}

// Chat form submission handler for follow-up questions
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value;
  if (!userInput.trim()) return;

  // Add user message to chat history
  chatHistory.push({ role: "user", content: userInput });

  // Show user message and loading state
  chatWindow.innerHTML += `<div class="user-message"><b>You:</b> ${userInput}</div>`;
  chatWindow.innerHTML += `<div class='placeholder-message'>Thinking...</div>`;

  // Call Cloudflare Worker API with chat history
  const reply = await getCloudflareChatCompletion(chatHistory);

  // Remove loading message and show assistant reply
  chatWindow.innerHTML = chatWindow.innerHTML.replace(
    /<div class='placeholder-message'>Thinking...<\/div>$/,
    "",
  );
  chatWindow.innerHTML += `<div class=\"assistant-message\"><b>Advisor:</b> ${reply.replace(/\n/g, "<br>")}</div>`;

  // Add assistant reply to chat history
  chatHistory.push({ role: "assistant", content: reply });

  // Clear input
  chatForm.reset();
});
