<?php

namespace App\Service;

class DataService
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    /**
     * Full reference-data payload (states, fuel types, truckMakes, trailerMakes, etc.).
     */
    public function getAll()
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('data', 'GET', null, $headers);
    }

    public function getTruckModels($makeId)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('data/truck-models?' . http_build_query(['makeId' => $makeId]), 'GET', null, $headers);
    }

    public function getTrailerModels($makeId)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('data/trailer-models?' . http_build_query(['makeId' => $makeId]), 'GET', null, $headers);
    }
}
