@IsTest
private class LabEventTriggerTest {
    @IsTest
    static void normalNameSaves() {
        insert new Lab_Event__c(Name = 'ok');
        System.assertEquals(1, [SELECT COUNT() FROM Lab_Event__c]);
    }

    @IsTest
    static void boomNameFails() {
        Boolean failed = false;
        try {
            insert new Lab_Event__c(Name = 'BOOM');
        } catch (DmlException e) {
            failed = true;
        }
        System.assert(failed, 'BOOM should fail');
    }
}
