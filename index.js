const API = (() => {
  const URL = "http://localhost:3000"; //base  URL

  const handleResponse = (response) => {
    //method to handle responses of API requests
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const getCart = () => {
    return fetch(`${URL}/cart`)
      .then(handleResponse)
      .catch((error) => {
        console.log(`Error Fetching cart: ${error}`);
      });
  };

  const getInventory = () => {
    return fetch(`${URL}/inventory`)
      .then(handleResponse)
      .catch((error) => {
        console.log(`Error Fetching Inventory: ${error}`);
      });
  };

  const addToCart = (inventoryItem) => {
    return fetch(`${URL}/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inventoryItem),
    })
      .then(handleResponse)
      .catch((error) => {
        console.log(`Error Adding Items to Cart: ${error}`);
      });
  };

  const updateCart = (id, newAmount) => {
    return fetch(`${URL}/cart/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: newAmount }),
    })
      .then(handleResponse)
      .catch((error) => {
        console.log(`Error Updating Items in Carty: ${error}`);
      });
  };

  const deleteFromCart = (id) => {
    return fetch(`${URL}/cart/${id}`, {
      method: "DELETE",
    })
      .then(handleResponse)
      .catch((error) => {
        console.log(`Error Deleting Items from Cart: ${error}`);
      });
  };

  const checkout = () => {
    return getCart().then((data) =>
      Promise.all(data.map((item) => deleteFromCart(item.id)))
    );
  };

  return {
    getCart,
    updateCart,
    getInventory,
    addToCart,
    deleteFromCart,
    checkout,
  };
})();

const Model = (() => {
  class State {
    #onChange;
    #inventory;
    #cart;
    constructor() {
      this.#inventory = [];
      this.#cart = [];
      // this.#onChange = () => {};
    }

    get cart() {
      return this.#cart;
    }

    get inventory() {
      return this.#inventory;
    }

    set cart(newCart) {
      this.#cart = newCart;
      this.#onChange();
    }

    set inventory(newInventory) {
      this.#inventory = newInventory;
      this.#onChange();
    }

    subscribe(cb) {
      this.#onChange = cb;
    }
  }

  return {
    State,
    ...API,
  };
})();

const View = (() => {
  const inventoryContainerEl = document.querySelector(
    ".inventory-container ul"
  );
  const cartContainerEl = document.querySelector(".cart-container ul");
  const checkoutBtn = document.querySelector(".checkout-btn");

  const renderInventory = (inventory) => {
    const fragment = document.createDocumentFragment();

    inventory.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${item.content}</span>
        <span class="inventory-li-buttons-span">
        <button class="decrement" data-id="${item.id}">-</button>
        <span class="amount" data-id="${item.id}">${item.amount || 0}</span>
        <button class="increment" data-id="${item.id}">+</button>
        <button class="add-to-cart" data-id="${item.id}">Add to Cart</button>
        </span>`;
      fragment.appendChild(li);
    });

    inventoryContainerEl.innerHTML = "";
    inventoryContainerEl.appendChild(fragment);
  };

  const renderCart = (cart) => {
    const fragment = document.createDocumentFragment();

    cart.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${item.content}</span>
        <span>${item.amount}</span>
        <button class="delete" data-id="${item.id}">Delete</button>`;
      fragment.appendChild(li);
    });

    cartContainerEl.innerHTML = "";
    cartContainerEl.appendChild(fragment);
  };

  return {
    renderInventory,
    renderCart,
    inventoryContainerEl,
    cartContainerEl,
    checkoutBtn,
  };
})();

const Controller = ((model, view) => {
  const state = new model.State();

  const init = () => {
    Promise.all([model.getInventory(), model.getCart()])
      .then(([inventory, cart]) => {
        state.inventory = inventory;
        state.cart = cart;
      })
      .catch((error) => {
        console.error("Error initializing app:", error);
      });
  };

  const handleUpdateAmount = (id, amount) => {
    state.inventory = state.inventory.map((item) =>
      item.id === id
        ? { ...item, amount: Math.max(0, (item.amount || 0) + amount) }
        : item
    );
  };

  const handleAddToCart = (id) => {
    const item = state.inventory.find((item) => item.id === id);
    if (item && item.amount > 0) {
      const cartItem = state.cart.find((cartItem) => cartItem.id === id);
      if (cartItem) {
        model
          .updateCart(id, cartItem.amount + item.amount)
          .then((updatedItem) => {
            state.cart = state.cart.map((item) =>
              item.id === id ? updatedItem : item
            );
            handleUpdateAmount(id, -item.amount);
          })
          .catch((error) => console.error("Error updating cart:", error));
      } else {
        model
          .addToCart({ ...item })
          .then((newItem) => {
            state.cart = [...state.cart, newItem];
            handleUpdateAmount(id, -item.amount);
          })
          .catch((error) => console.error("Error adding to cart:", error));
      }
    }
  };

  const handleDelete = (id) => {
    model
      .deleteFromCart(id)
      .then(() => {
        state.cart = state.cart.filter((item) => item.id !== id);
      })
      .catch((error) => console.error("Error deleting from cart:", error));
  };

  const handleCheckout = () => {
    model
      .checkout()
      .then(() => {
        state.cart = [];
      })
      .catch((error) => console.error("Error during checkout:", error));
  };

  const bootstrap = () => {
    state.subscribe(() => {
      view.renderInventory(state.inventory);
      view.renderCart(state.cart);
    });
    init();
    view.inventoryContainerEl.addEventListener("click", (event) => {
      const id = parseInt(event.target.dataset.id);
      if (event.target.classList.contains("decrement")) {
        handleUpdateAmount(id, -1);
      } else if (event.target.classList.contains("increment")) {
        handleUpdateAmount(id, 1);
      } else if (event.target.classList.contains("add-to-cart")) {
        handleAddToCart(id);
      }
    });

    view.cartContainerEl.addEventListener("click", (event) => {
      if (event.target.classList.contains("delete")) {
        const id = parseInt(event.target.dataset.id);
        handleDelete(id);
      }
    });

    view.checkoutBtn.addEventListener("click", handleCheckout);
  };
  return {
    bootstrap,
  };
})(Model, View);

Controller.bootstrap();
