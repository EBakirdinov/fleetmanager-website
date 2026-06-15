<?php

namespace App\Service;

class DriverService
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    public function getList(array $params = [])
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        $path = 'driver';
        if (!empty($params)) {
            $path .= '?' . http_build_query($params);
        }
        return $this->accountService->request($path, 'GET', null, $headers);
    }

    public function get($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/' . $id, 'GET', null, $headers);
    }

    public function create(array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver', 'POST', $data, $headers);
    }

    public function update($id, array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/' . $id, 'PATCH', $data, $headers);
    }

    public function delete($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/' . $id, 'DELETE', null, $headers);
    }

    /**
     * Drivers with no assigned truck (available for assignment).
     */
    public function getAvailable()
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/available', 'GET', null, $headers);
    }

    /**
     * Assign a truck to a driver. The driver owns the relationship, so the link
     * is set from the driver side. return=true makes the API respond 200 + body.
     */
    public function assignTruck($driverId, $truckId)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/' . $driverId . '?return=true', 'PATCH', ['assignedTruck' => $truckId], $headers);
    }

    /**
     * Clear a driver's assigned truck.
     */
    public function unassignTruck($driverId)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('driver/' . $driverId . '?return=true', 'PATCH', ['assignedTruck' => null], $headers);
    }
}
