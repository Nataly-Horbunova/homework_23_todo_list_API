class ToDoList {
    #baseUrl = 'https://todo.hillel.it';
    #token = '';
    #headers =''

    constructor () {
        this.tasks = [];
    }

    async getAllFromStorage() {
        const headers = new Headers();
        headers.set('Authorization', `Bearer ${this.#token}`);
        headers.set('Content-Type', 'application/json');
        this.#headers = headers;

        const response = await fetch(`${this.#baseUrl}/todo`, {
            headers: this.#headers
        });

        if(response.ok) {
            const storageTasks = await response.json();
            this.tasks = storageTasks;
        } else {
            throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
        }
    }

    async auth(email = null, password = null) {
        const ref = localStorage.getItem('authToken');

        if (ref) {
            this.#token = ref;
        } else {
            const authValue = `${email}${password}`;
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            const requestBody = JSON.stringify({ value: authValue });

            const response = await fetch(`${this.#baseUrl}/auth/login`, {
                method: 'POST',
                headers,
                body: requestBody
            });

            if(response.ok) {
                const {access_token: accessToken} = await response.json();
                this.#token = accessToken;
                localStorage.setItem('authToken', this.#token);
            } else {
                throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
            }
        }
        await this.getAllFromStorage();
    }

    async addTask(value, priority) {
        const isUinque = !this.tasks.find(item => item.value === value);

        if (isUinque) {
            const requestBody = JSON.stringify({
                value,
                priority: Number(priority)
            });

            const response = await fetch(`${this.#baseUrl}/todo`, {
                method: 'POST',
                headers: this.#headers,
                body: requestBody
            });

            if(response.ok) {
                const task = await response.json();
                this.tasks.push(task);
            } else {
                throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
            }
        }
    }

    async deleteTask(id) {
        const response = await fetch (`${this.#baseUrl}/todo/${id}`, {
            method: 'DELETE',
            headers: this.#headers
        });

        if(response.ok) {
            this.tasks = this.tasks.filter(({ _id }) => _id !== Number(id));
        } else {
            throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
        }
    }

    async editTask(id, textEdited, priority) {
        const editIndex = this.tasks.findIndex(item => item._id === Number(id));
        const notFoundIndex = -1;

        if (editIndex === notFoundIndex) return;

        const isEmpty = !textEdited;
        const tasksWithoutEdited = this.tasks.filter(item => item._id !== Number(id));
        const isUinque = !tasksWithoutEdited.find(item => item.value === textEdited);

        if(!isEmpty && isUinque) {
            const requestBody = JSON.stringify({
                value: textEdited,
                priority: Number(priority)
            });

            const response = await fetch(`${this.#baseUrl}/todo/${id}`, {
                method: 'PUT',
                headers: this.#headers,
                body: requestBody
            });

            if(response.ok) {
                this.tasks[editIndex].value = textEdited;
                this.tasks[editIndex].priority = priority;
            } else {
                throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
            }
        }
    }

    async toggleState(id) {
        const index = this.tasks.findIndex(item => item._id === Number(id));
        const notFoundIndex = -1;

        if (index!== notFoundIndex) {
            const response = await fetch(`${this.#baseUrl}/todo/${id}/toggle`, {
                method: 'PUT',
                headers: this.#headers,
            });

            if(response.ok) {
                this.tasks[index].checked = !this.tasks[index].checked;
            } else {
                throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
            }
        }
    }

    getStatisctics() {
        return this.tasks.reduce((accum, item) => {
            item.checked ? accum.completed++ : accum.active++;
            return accum;
        }, {
            active: 0,
            completed: 0,
            total: this.tasks.length
        });
    }
}

Object.defineProperties(ToDoList.prototype, {
    addTask: {configurable: false},
    deleteTask: {configurable: false},
    editTask: {configurable: false},
    toggleState: {configurable: false},
    getStatisctics: {configurable: false},
    getAllFromStorage: {configurable: false},
    auth: {configurable: false}
});


class TodoListView {
    constructor (listModel) {
        this.listModel = listModel;
        this.loginForm = document.querySelector('.login-form');
        this.addForm = document.querySelector('.add-form');
        this.list = document.querySelector('.list');

        this.login = function(){
            const authSection = document.querySelector('.auth');
            const toDoSection = document.querySelector('.todo-form');
            const ref = localStorage.getItem('authToken');

            if (ref) {
                this.listModel.auth()
                    .then(() => {
                        this.renderToDoList();
                        toDoSection.classList.remove('hidden');
                    })
                    .catch(alert);
            } else {
                authSection.classList.remove('hidden');
                this.loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const data = new FormData(e.target);
                    const email = data.get('email');
                    const password = data.get('password');

                    if (email && password) {
                        e.submitter.classList.add('loading');
                        e.submitter.setAttribute('disabled', '');
                        this.listModel.auth(email, password)
                            .then ( () => {
                                this.renderToDoList();
                                authSection.classList.add('hidden');
                                toDoSection.classList.remove('hidden');
                            })
                            .catch(alert)
                            .finally(() => {
                                e.submitter.classList.remove('loading');
                                e.submitter.removeAttribute('disabled', '');
                            });
                    }
                });
            }
        };

        this.logout = function() {
            const logoutBtn = document.querySelector('.logout-btn');
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('authToken');
                document.location.reload();
            });
        };

        this.renderToDoList = function(){
            this.list.innerHTML = '';
            if (!this.listModel.tasks.length) return;

            const fragment = new DocumentFragment;

            for (const toDoItem of this.listModel.tasks) {
                const li = document.createElement('li');
                li.classList.add('list-item', `priority-${toDoItem.priority}`);
                li.dataset.id = toDoItem._id;

                const text = document.createElement('p');
                text.classList.add('list-item__text');
                text.textContent = toDoItem.value;

                const checkboxWrap = document.createElement('div');
                checkboxWrap.classList.add('list-item__state');

                const checkbox = document.createElement('input');
                checkbox.classList.add('list-item__checkbox');
                checkbox.setAttribute('type', 'checkbox');

                const preloader = document.createElement('div');
                preloader.classList.add('preloader');

                checkboxWrap.append(checkbox, preloader);

                li.append(text, checkboxWrap);

                li.insertAdjacentHTML('beforeend',
                    `<button type="button" class="button list-item__edit fa-solid fa-pen-to-square"></button>
                    <button type="button" class="button list-item__delete fa-solid fa-xmark">
                    <div class="preloader"></div></button>`);

                if (toDoItem.checked) {
                    li.classList.add('list-item_completed');
                    text.classList.add('list-item__text_completed');
                    checkbox.setAttribute('checked', '');
                }

                fragment.append(li);
            }

            this.list.append(fragment);
            const statBtn = document.querySelector('.statistics-btn');
            statBtn.classList.remove('hidden');

            const todosBlock = document.querySelector('.to-dos');
            todosBlock.classList.remove('hidden');
        };

        this.initSubmit = function() {
            this.addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const data = new FormData(e.target);
                const text = data.get('text').trim();
                const priority = data.get('priority');

                if (text && priority) {
                    e.submitter.classList.add('loading');
                    e.submitter.setAttribute('disabled', '');
                    this.listModel.addTask(text, priority)
                        .then( () => this.renderToDoList())
                        .catch(alert)
                        .finally(() => {
                            e.submitter.classList.remove('loading');
                            e.submitter.removeAttribute('disabled', '');
                            e.target.reset();
                        });
                }
            });
        };

        this.initRemove = function(){
            this.list.addEventListener('click', ({target}) => {
                if (!target.classList.contains('list-item__delete')) return;

                const deleteItem = target.closest('[data-id]');
                const id = deleteItem.getAttribute('data-id');

                if (id) {
                    target.classList.remove('fa-solid', 'fa-xmark');
                    target.classList.add('loading');
                    target.setAttribute('disabled', '');
                    this.listModel.deleteTask(id)
                        .then(() => {
                            this.renderToDoList();
                        })
                        .catch(alert)
                        .finally(() => {
                            target.classList.add('fa-solid', 'fa-xmark');
                            target.classList.remove('loading');
                            target.removeAttribute('disabled', '');
                        });
                }
            });
        };

        this.initToogleState = function(){
            this.list.addEventListener('change', ({target}) => {
                if (!target.classList.contains('list-item__checkbox')) return;

                const toggleItem = target.closest('[data-id]');
                const id = toggleItem.getAttribute('data-id');
                const toggleItemText = document.querySelector(`li[data-id="${id}"] .list-item__text`);

                if (id) {
                    target.closest('.list-item__state').classList.add('loading');
                    this.listModel.toggleState(id)
                        .then(() => {
                            toggleItemText.classList.toggle('list-item__text_completed');
                            toggleItem.classList.toggle('list-item_completed');
                        })
                        .catch(alert)
                        .finally(() => {
                            target.closest('.list-item__state').classList.remove('loading');
                        });
                }
            });
        };

        this.initEdit = function(){
            this.list.addEventListener('click', ({target}) => {
                if (!target.classList.contains('list-item__edit')) return;

                target.style.display = 'none';

                const editItem = target.closest('[data-id]');
                const id = editItem.getAttribute('data-id');

                if (!id) return;

                const task = document.querySelector(`li[data-id="${id}"]`);
                const taskText = document.querySelector(`li[data-id="${id}"] .list-item__text`);
                const taskInnerText = taskText.innerText;
                const fragment = new DocumentFragment;

                const form = document.createElement('form');
                form.classList.add('edit-form');
                form.setAttribute('name', 'editForm');

                const text = document.createElement('input');
                text.classList.add('input', 'edit-form__text');
                text.setAttribute('type', 'text');
                text.setAttribute('name', 'text');
                text.setAttribute('value', `${taskInnerText}`);

                const priority = document.createElement('select');
                priority.classList.add('select', 'edit-form__select');
                priority.setAttribute('name', 'priority');

                const priorityChooseOption = new Option ('Choose priority', 'Choose priority');
                priorityChooseOption.setAttribute('disabled', '');
                priority.append(priorityChooseOption);

                const priorityCount = 3;

                for(let i = 1; i <= priorityCount; i++) {
                    const priorityOption = new Option (i, i);
                    priorityOption.classList.add('priority__item');
                    priority.append(priorityOption);

                    if (task.classList.contains(`priority-${i}`)) {
                        priorityOption.setAttribute('selected','');
                    }
                }

                const submit = document.createElement('button');
                submit.classList.add('button', 'edit-form__save');

                const submitText = document.createElement('span');
                submitText.textContent = 'Save';

                const preloader = document.createElement('div');
                preloader.classList.add('preloader');
                submit.append(submitText, preloader);

                const cancel = document.createElement('button');
                cancel.classList.add('button', 'edit-form__cancel');
                cancel.textContent = 'Cancel';

                form.append(text, priority, submit, cancel);
                fragment.append(form);
                taskText.classList.add('hidden');
                task.prepend(fragment);

                const editForm = document.querySelector('.edit-form');

                editForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const data = new FormData(e.target);
                    const textEdited = data.get('text').trim();
                    const priorityEdited = data.get('priority');

                    if (e.submitter.classList.contains('edit-form__save') && textEdited && priorityEdited) {
                        e.submitter.classList.add('loading');
                        e.submitter.setAttribute('disabled', '');
                        this.listModel.editTask(id, textEdited, priorityEdited)
                            .then (() => {
                                this.renderToDoList();
                            })
                            .catch(alert)
                            .finally(() => {
                                e.submitter.classList.remove('loading');
                                e.submitter.removeAttribute('disabled', '');
                            });
                    } else if (e.submitter.classList.contains('edit-form__cancel') || !textEdited) {
                        this.renderToDoList();
                    }
                });
            });
        };

        this.initStatistics = function(){
            const statistics = document.querySelector('.statistics-btn');
            const activeTasks = document.querySelector('.statistics-list__active');
            const completedTasks = document.querySelector('.statistics-list__completed');
            const totalTasks = document.querySelector('.statistics-list__total');

            statistics.addEventListener('click', () => {
                const result = this.listModel.getStatisctics();
                const {active, completed, total} = result;
                activeTasks.innerText = `Active tasks: ${active}`;
                completedTasks.innerText = `Completed tasks: ${completed}`;
                totalTasks.innerText = `Total: ${total}`;
            });

            statistics.addEventListener('blur', () => {
                activeTasks.innerText = '';
                completedTasks.innerText = '';
                totalTasks.innerText = '';
            });
        };

        this.hideCompleted = function(){
            const hideBtn = document.querySelector('.to-dos__hide-btn');

            hideBtn.addEventListener('click', () => {
                const completedItems = document.querySelectorAll('.list-item_completed');
                if (hideBtn.innerText === 'Hide completed') {
                    hideBtn.innerText = 'Show completed';

                    for (const item of completedItems) {
                        item.classList.add('hidden');
                    }

                } else {
                    hideBtn.innerText = 'Hide completed';

                    for (const item of completedItems) {
                        item.classList.remove('hidden');
                    }
                }
            });
        };

        this.login();
        this.logout();
        this.initSubmit();
        this.initRemove();
        this.initToogleState();
        this.initStatistics();
        this.initEdit();
        this.hideCompleted();
    }
}

// eslint-disable-next-line no-unused-vars
const toDo = new TodoListView(new ToDoList);