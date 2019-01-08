import PubSub from '../core/pubsub';

export default class Store {
    constructor(params) {
        let self = this;

        // Add some default objects to hold our actions, mutations and state
        self.actions = {};
        self.mutations = {};
        self.isConsoleGroupOpen = false;

        // A status enum to set during actions and mutations
        self.status = 'resting';
 
        // Attach our PubSub module as an `events` element
        self.events = new PubSub();

        // Look in the passed params object for actions and mutations 
        // that might have been passed in
        if(params.hasOwnProperty('actions')) {
            self.actions = params.actions;
        }
        
        if(params.hasOwnProperty('mutations')) {
            self.mutations = params.mutations;
        }


        // Set our state to be a Proxy. We are setting the default state by 
        // checking the params and defaulting to an empty object if no default 
        // state is passed in
        self.state = new Proxy((params.state || {}), {
            set: function(state, key, value) {

                // Don't allow state changes without mutation
                if(self.status !== 'mutation') {
                    console.warn(`You should use a mutation to set ${key}`);
                    return false;
                } 

                // Set the value as we would normally
                let oldValue = state[key];
                state[key] = value;
                
                // Trace out to the console. This will be grouped by the related action
                console.log(`state :: ${key}: ${oldValue} => ${value}`);
                

                return true;
            }
        });
    }

    /**
     * Look for a mutation and modify the state object 
     * if that mutation exists by calling it
     *
     * @param {string} mutationKey
     * @param {mixed} payload
     * @returns {boolean}
     * @memberof Store
     */
    commit(mutationKey, payload) {
        let self = this;

        // Run a quick check to see if this mutation actually exists
        // before trying to run it
        if(typeof self.mutations[mutationKey] !== 'function') {
            console.log(`Mutation "${mutationKey}" doesn't exist`);
            return false;
        }

        // Let anything that's watching the status know that we're mutating state
        self.status = 'mutation';
        
        // Get a new version of the state by running the mutation and storing the result of it
        let oldState = Object.assign({}, self.state);
        let newState = self.mutations[mutationKey](oldState, payload);
        
        // Merge the old and new together to create a new state and set it
        self.state = Object.assign(self.state, newState);

        // Publish the change event for the components that are listening
        self.events.publish('stateChange', self.state);

        // Reset the status ready for the next operation
        self.status = 'resting';
        
        return true;
    }

    /**
     * A dispatcher for actions that looks in the actions 
     * collection and runs the action if it can find it
     *
     * @param {string} actionKey
     * @param {mixed} payload
     * @returns {boolean}
     * @memberof Store
     */
    dispatch(actionKey, payload) {
        let self = this;
        
        // Run a quick check to see if the action actually exists
        // before we try to run it
        if(typeof self.actions[actionKey] !== 'function') {
          console.error(`Action "${actionKey} doesn't exist.`);
          return false;
        }
        
        if (self.isConsoleGroupOpen) {
            console.groupEnd();
            self.isConsoleGroupOpen = false;
        }
        // Create a console group which will contain the logs from our Proxy etc
        console.groupCollapsed(`ACTION: ${actionKey}`);
        self.isConsoleGroupOpen = true;

        // Let anything that's watching the status know that we're dispatching an action
        self.status = 'action';
        
        // Actually call the action and pass it the Store context and whatever payload was passed
        self.actions[actionKey](self, payload);

        // Close our console group to keep things nice and neat
        console.groupEnd();
        self.isConsoleGroupOpen = false;

        return true;
    }



}