trigger LabEventTrigger on Lab_Event__c (before insert) {
    for (Lab_Event__c e : Trigger.new) {
        if (e.Name == 'BOOM') {
            // Deliberate unhandled exception so loads return CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY.
            Integer zero = 0;
            Integer boom = 1 / zero;
        }
    }
}
